import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { Random } from '../core/Random';
import { CONFIG } from '../game/config';
import type { ForegroundConfig, ForegroundKind } from '../landscape/LandscapeConfig';

function makeSilhouettes(kind: ForegroundKind, seed: number): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const depth = 19; // In front of the player (z=0), but behind the camera (z=120).
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
    const count = 32;
    const step = CONFIG.worldWidth / count;
    for (let i = 0; i < count; i++) {
      const x = step * (i + 0.5) + random.range(-10, 10);
      const tall = random.range(14, 29);
      const base = random.range(3, 7);
      rect(x - 0.85, base, 1.7, tall * 0.55);
      triangle(x, base + tall * 0.28, tall * 0.32, tall * 0.55);
      triangle(x, base + tall * 0.50, tall * 0.25, tall * 0.50);
    }
  } else {
    const count = kind === 'grille' ? 80 : 64;
    const step = CONFIG.worldWidth / count;
    for (let i = 0; i < count; i++) {
      const x = i * step;
      rect(x, 5, kind === 'grille' ? 1.15 : 1.7, kind === 'grille' ? 27 : 15);
      if (kind === 'fence' && i % 4 === 0) triangle(x + 0.85, 20, 1.1, 2);
    }
    rect(0, kind === 'grille' ? 9 : 10, CONFIG.worldWidth, kind === 'grille' ? 1.2 : 0.9);
    rect(0, kind === 'grille' ? 27 : 17, CONFIG.worldWidth, kind === 'grille' ? 1.2 : 0.9);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Decorative geometry, kept entirely outside simulation and collision systems. */
export class ForegroundDecor {
  readonly group = new Group();
  private geometry: BufferGeometry | null = null;
  private material: MeshBasicNodeMaterial | null = null;
  private readonly copies: Mesh[] = [];
  private parallax = 1;

  rebuild(config: ForegroundConfig, gameSeed: number, styleSeed: number, wave: number): void {
    this.dispose();
    if (!config.enabled) return;
    const seed = (gameSeed ^ styleSeed ^ Math.imul(wave, 0x9e3779b9)) >>> 0;
    this.geometry = makeSilhouettes(config.kind, seed);
    this.material = new MeshBasicNodeMaterial({
      color: Number.parseInt(config.color.slice(1), 16),
      opacity: config.opacity, transparent: true, depthWrite: false, toneMapped: false,
    });
    this.parallax = config.parallax;
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(this.geometry, this.material);
      mesh.frustumCulled = false;
      this.copies.push(mesh);
      this.group.add(mesh);
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
    this.material?.dispose();
    this.geometry = null;
    this.material = null;
  }
}
