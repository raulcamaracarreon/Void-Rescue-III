import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { Random } from '../core/Random';
import { CONFIG } from '../game/config';
import { blankDecorBitmap, sanitizeDecorBitmap } from '../landscape/LandscapeConfig';
import type { DecorBitmap, ForegroundConfig, ForegroundKind } from '../landscape/LandscapeConfig';

/** Z-axis ordering in the orthographic camera: mountains < middle < vehicle < front. */
export const MIDGROUND_DEPTH = -18;
export const FOREGROUND_DEPTH = 19;

/** A partial strip occupies only the initial segment of each wrapped world repeat.
 * Individual shapes retain their physical width; the remaining segment stays empty.
 */
export function decorSpanWidth(spanPercent: number): number {
  return CONFIG.worldWidth * Math.max(5, Math.min(100, spanPercent)) / 100;
}

/** A bitmap is a motif (not an entire landscape): 50 world units high.
 * With a locked 3:1 aspect ratio each motif is exactly 150 world units wide.
 */
export function drawingMotifWidth(bitmap: DecorBitmap): number {
  return bitmap.width * 50 / bitmap.height;
}

/** Build the motif ONCE, sharing geometry across wrapped worlds and repeats.
 * The last tile may be cropped at spanWidth; never scale a motif horizontally.
 */
function makeDrawingGeometry(bitmap: DecorBitmap, depth: number, widthLimit: number): BufferGeometry {
  const pixels = sanitizeDecorBitmap(bitmap);
  const cell = 50 / pixels.height;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < pixels.height; row++) {
    const line = pixels.rows[row]!;
    const y = 5 + (pixels.height - row - 1) * cell;
    let column = 0;
    while (column * cell < widthLimit && column < pixels.width) {
      if (line[column] !== '1') { column++; continue; }
      const start = column;
      while (column < pixels.width && line[column] === '1' && column * cell < widthLimit) column++;
      const x = start * cell;
      const width = Math.min(column * cell, widthLimit) - x;
      if (width <= 0) continue;
      const i = vertices.length / 3;
      vertices.push(x, y, depth, x + width, y, depth,
        x + width, y + cell, depth, x, y + cell, depth);
      indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSilhouettes(kind: Exclude<ForegroundKind, 'drawing'>, seed: number, depth: number,
  spanPercent: number): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const spanWidth = decorSpanWidth(spanPercent);
  const rect = (x: number, y: number, w: number, h: number): void => {
    const i = vertices.length / 3;
    vertices.push(x, y, depth, x + w, y, depth, x + w, y + h, depth, x, y + h, depth);
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const triangle = (x: number, y: number, halfWidth: number, height: number): void => {
    const i = vertices.length / 3;
    vertices.push(x - halfWidth, y, depth, x + halfWidth, y, depth, x, y + height, depth);
    indices.push(i, i + 1, i + 2);
  };
  if (kind === 'trees') {
    const random = new Random(seed >>> 0);
    // Keep the original average spacing instead of stretching trees to fit the strip.
    const count = Math.max(1, Math.floor(spanWidth / 75));
    const step = spanWidth / count;
    for (let i = 0; i < count; i++) {
      const x = step * (i + 0.5) + random.range(-10, 10);
      const tall = random.range(14, 29);
      const base = random.range(3, 7);
      rect(x - 0.85, base, 1.7, tall * 0.55);
      triangle(x, base + tall * 0.28, tall * 0.32, tall * 0.55);
      triangle(x, base + tall * 0.50, tall * 0.25, tall * 0.50);
    }
  } else if (kind === 'buildings') {
    const random = new Random(seed >>> 0);
    let x = 3;
    while (x < spanWidth - 8) {
      const width = Math.min(random.range(13, 31), spanWidth - x);
      if (width < 8) break;
      const height = random.range(13, 36);
      rect(x, 5, width, height);
      // A few rooftop structures lend variety without turning buildings into colliders.
      if (random.next() > 0.4) {
        const rooftopWidth = Math.min(width * random.range(0.25, 0.6), spanWidth - x - 2);
        rect(x + 2, height + 5, rooftopWidth, random.range(1.5, 4.5));
      }
      if (random.next() > 0.78) {
        const mastX = Math.min(x + width * 0.7, spanWidth - 1);
        rect(mastX, height + 5, 0.6, random.range(4, 11));
      }
      x += width + random.range(4, 10);
    }
  } else {
    const step = CONFIG.worldWidth / (kind === 'grille' ? 80 : 64);
    const postWidth = kind === 'grille' ? 1.15 : 1.7;
    const count = Math.floor((spanWidth - postWidth) / step) + 1;
    for (let i = 0; i < count; i++) {
      const x = i * step;
      rect(x, 5, postWidth, kind === 'grille' ? 27 : 15);
      if (kind === 'fence' && i % 4 === 0) triangle(x + 0.85, 20, 1.1, 2);
    }
    rect(0, kind === 'grille' ? 9 : 10, spanWidth, kind === 'grille' ? 1.2 : 0.9);
    rect(0, kind === 'grille' ? 27 : 17, spanWidth, kind === 'grille' ? 1.2 : 0.9);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Reusable decorative layer: geometry only, never a collider or simulated entity. */
export class ForegroundDecor {
  readonly group = new Group();
  private geometry: BufferGeometry | null = null;
  private material: MeshBasicNodeMaterial | null = null;
  private partialGeometry: BufferGeometry | null = null;
  private readonly copies: (Mesh | Group)[] = [];
  private parallax = 1;

  constructor(private readonly depth = FOREGROUND_DEPTH, private readonly seedOffset = 0) {}

  rebuild(config: ForegroundConfig, gameSeed: number, styleSeed: number, wave: number): void {
    this.dispose();
    if (!config.enabled) return;
    const seed = (gameSeed ^ styleSeed ^ this.seedOffset ^ Math.imul(wave, 0x9e3779b9)) >>> 0;
    const drawing = config.kind === 'drawing';
    const mask = drawing ? sanitizeDecorBitmap(config.bitmap ?? blankDecorBitmap()) : null;
    const width = mask ? drawingMotifWidth(mask) : 0;
    const span = decorSpanWidth(config.spanPercent);
    this.geometry = mask
      ? makeDrawingGeometry(mask, this.depth, width)
      : makeSilhouettes(config.kind as Exclude<ForegroundKind, 'drawing'>,
        seed, this.depth, config.spanPercent);
    this.material = new MeshBasicNodeMaterial({
      color: Number.parseInt(config.color.slice(1), 16),
      opacity: config.opacity, transparent: true, depthWrite: false, toneMapped: false,
    });
    this.parallax = config.parallax;
    const repetitions = mask ? Math.ceil(span / width) : 0;
    const remainder = mask ? span - (repetitions - 1) * width : 0;
    if (mask && remainder < width - 0.000001)
      this.partialGeometry = makeDrawingGeometry(mask, this.depth, remainder);
    for (let i = 0; i < 3; i++) {
      if (mask) {
        const copy = new Group();
        for (let tile = 0; tile < repetitions; tile++) {
          const cropped = tile === repetitions - 1 && this.partialGeometry;
          const mesh = new Mesh(cropped ? this.partialGeometry! : this.geometry, this.material);
          mesh.position.x = tile * width;
          // Geometry is shared for every repeat; only the final tile is cropped.
          // Let the renderer cull offscreen repeated motifs for better performance.
          mesh.renderOrder = this.depth > 0 ? 1 : -1;
          copy.add(mesh);
        }
        this.copies.push(copy);
        this.group.add(copy);
      } else {
        const mesh = new Mesh(this.geometry, this.material);
        mesh.frustumCulled = false;
        // Opaque vehicles still occlude the middle through depth testing.
        mesh.renderOrder = this.depth > 0 ? 1 : -1;
        this.copies.push(mesh);
        this.group.add(mesh);
      }
    }
  }

  update(cameraX: number, reducedMotion = false): void {
    const effectiveParallax = reducedMotion ? 1 : this.parallax;
    const offset = cameraX * effectiveParallax;
    const center = Math.floor(offset / CONFIG.worldWidth);
    this.copies.forEach((mesh, i) => {
      mesh.position.x = (center + i - 1) * CONFIG.worldWidth - cameraX * (effectiveParallax - 1);
    });
  }

  dispose(): void {
    this.group.clear();
    this.copies.length = 0;
    this.geometry?.dispose();
    this.partialGeometry?.dispose();
    this.material?.dispose();
    this.geometry = null;
    this.partialGeometry = null;
    this.material = null;
  }
}
