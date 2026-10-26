import {
  blankDecorBitmap, DECOR_BITMAP_HEIGHT, DECOR_BITMAP_WIDTH, sanitizeDecorBitmap,
} from '../landscape/LandscapeConfig';
import type { DecorBitmap } from '../landscape/LandscapeConfig';
import { decorInkCount, drawDecorPixels } from '../landscape/DecorDrawing';
import type { DecorDrawTool, PixelPoint } from '../landscape/DecorDrawing';

/** Small self-contained raster editor. Editing the draft does not mutate saved styles
 * until Aplicar is pressed; Cancelar discards it entirely. */
export class DecorPaintEditor {
  private readonly dialog: HTMLDialogElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tool: HTMLSelectElement;
  private readonly status: HTMLElement;
  private bitmap: DecorBitmap = blankDecorBitmap();
  private undo: DecorBitmap[] = [];
  private redo: DecorBitmap[] = [];
  private pointer: number | null = null;
  private start: PixelPoint = { x: 0, y: 0 };
  private last: PixelPoint = { x: 0, y: 0 };
  private snapshot: DecorBitmap | null = null;
  private onApply: ((result: DecorBitmap) => void) | null = null;

  constructor(root: HTMLElement) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'pause-dialog decor-paint-dialog';
    this.dialog.setAttribute('aria-label', 'Editor de dibujo de plano');
    this.dialog.innerHTML = `
      <h2 class="decor-paint-title">Editor de siluetas</h2>
      <p class="landscape-help">Pinta una máscara de un color: los cuadros claros se mostrarán con el color y la opacidad del plano. El ancho del dibujo se adapta a la longitud lateral configurada. Sin colisiones.</p>
      <div class="decor-paint-toolbar">
        <label>Herramienta
          <select class="decor-paint-tool" aria-label="Herramienta de dibujo">
            <option value="brush">Pincel</option>
            <option value="eraser">Borrador</option>
            <option value="line">Línea</option>
            <option value="rectangle">Rectángulo</option>
          </select>
        </label>
        <button type="button" data-paint="undo">Deshacer</button>
        <button type="button" data-paint="redo">Rehacer</button>
        <button type="button" data-paint="clear">Limpiar</button>
      </div>
      <canvas class="decor-paint-canvas" width="768" height="256" aria-label="Lienzo de dibujo de silueta" tabindex="0"></canvas>
      <p class="decor-paint-status" role="status"></p>
      <div class="decor-paint-buttons">
        <button type="button" data-paint="cancel">Cancelar</button>
        <button type="button" class="primary" data-paint="apply">Aplicar dibujo</button>
      </div>
    `;
    root.append(this.dialog);
    this.canvas = this.dialog.querySelector<HTMLCanvasElement>('canvas')!;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.tool = this.dialog.querySelector<HTMLSelectElement>('.decor-paint-tool')!;
    this.status = this.dialog.querySelector<HTMLElement>('.decor-paint-status')!;

    this.canvas.addEventListener('pointerdown', event => {
      if (this.pointer !== null || event.button !== 0) return;
      event.preventDefault();
      this.pointer = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.snapshot = sanitizeDecorBitmap(this.bitmap);
      this.start = this.point(event);
      this.last = this.start;
      this.bitmap = drawDecorPixels(this.bitmap, this.tool.value as DecorDrawTool,
        this.start, this.start);
      this.paint();
    });
    this.canvas.addEventListener('pointermove', event => {
      if (this.pointer !== event.pointerId) return;
      event.preventDefault();
      this.extend(event);
    });
    this.canvas.addEventListener('pointerup', event => {
      if (this.pointer !== event.pointerId) return;
      this.extend(event);
      if (this.snapshot && this.snapshot.rows.join('') !== this.bitmap.rows.join('')) {
        this.undo.push(this.snapshot);
        if (this.undo.length > 30) this.undo.shift();
        this.redo = [];
      }
      this.pointer = null;
      this.snapshot = null;
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
      this.paint();
    });
    this.canvas.addEventListener('pointercancel', event => {
      if (this.pointer !== event.pointerId) return;
      if (this.snapshot) this.bitmap = this.snapshot;
      this.pointer = null; this.snapshot = null; this.paint();
    });

    this.dialog.querySelector<HTMLButtonElement>('[data-paint="undo"]')!.addEventListener('click', () => this.stepBack());
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="redo"]')!.addEventListener('click', () => this.stepForward());
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="clear"]')!.addEventListener('click', () => {
      if (decorInkCount(this.bitmap) === 0) return;
      this.undo.push(sanitizeDecorBitmap(this.bitmap));
      if (this.undo.length > 30) this.undo.shift();
      this.redo = [];
      this.bitmap = blankDecorBitmap();
      this.paint();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="apply"]')!.addEventListener('click', () => {
      this.onApply?.(sanitizeDecorBitmap(this.bitmap));
      this.close();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="cancel"]')!.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.stepForward();
        else this.stepBack();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault(); this.stepForward();
      }
    });
  }

  show(planeLabel: string, previous: DecorBitmap | undefined,
    apply: (bitmap: DecorBitmap) => void): void {
    this.bitmap = sanitizeDecorBitmap(previous);
    this.undo = []; this.redo = []; this.pointer = null; this.snapshot = null;
    this.onApply = apply;
    this.tool.value = 'brush';
    this.dialog.querySelector<HTMLElement>('.decor-paint-title')!.textContent =
      `Dibujar ${planeLabel}`;
    this.paint();
    this.dialog.showModal();
    this.canvas.focus({ preventScroll: true });
  }

  get open(): boolean { return this.dialog.open; }
  dismiss(): void { this.close(); }

  private close(): void {
    if (this.dialog.open) this.dialog.close();
    this.onApply = null;
  }

  private point(event: PointerEvent): PixelPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(DECOR_BITMAP_WIDTH - 1,
        Math.floor((event.clientX - rect.left) / rect.width * DECOR_BITMAP_WIDTH))),
      y: Math.max(0, Math.min(DECOR_BITMAP_HEIGHT - 1,
        Math.floor((event.clientY - rect.top) / rect.height * DECOR_BITMAP_HEIGHT))),
    };
  }

  private extend(event: PointerEvent): void {
    const next = this.point(event);
    const tool = this.tool.value as DecorDrawTool;
    if (tool === 'line' || tool === 'rectangle') {
      this.bitmap = drawDecorPixels(this.snapshot!, tool, this.start, next);
    } else {
      this.bitmap = drawDecorPixels(this.bitmap, tool, this.last, next);
    }
    this.last = next;
    this.paint();
  }

  private stepBack(): void {
    const last = this.undo.pop();
    if (!last) return;
    this.redo.push(this.bitmap);
    this.bitmap = last;
    this.paint();
  }

  private stepForward(): void {
    const next = this.redo.pop();
    if (!next) return;
    this.undo.push(this.bitmap);
    this.bitmap = next;
    this.paint();
  }

  private paint(): void {
    const stepX = this.canvas.width / DECOR_BITMAP_WIDTH;
    const stepY = this.canvas.height / DECOR_BITMAP_HEIGHT;
    this.ctx.fillStyle = '#082024';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#a4f5d6';
    for (let y = 0; y < DECOR_BITMAP_HEIGHT; y++) {
      const row = this.bitmap.rows[y]!;
      for (let x = 0; x < DECOR_BITMAP_WIDTH; x++) {
        if (row[x] === '1') this.ctx.fillRect(x * stepX, y * stepY, stepX, stepY);
      }
    }
    this.ctx.strokeStyle = '#43706b50';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= DECOR_BITMAP_WIDTH; x += 4) {
      this.ctx.moveTo(x * stepX + 0.5, 0);
      this.ctx.lineTo(x * stepX + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= DECOR_BITMAP_HEIGHT; y += 4) {
      this.ctx.moveTo(0, y * stepY + 0.5);
      this.ctx.lineTo(this.canvas.width, y * stepY + 0.5);
    }
    this.ctx.stroke();
    this.status.textContent = `${DECOR_BITMAP_WIDTH} × ${DECOR_BITMAP_HEIGHT} píxeles · ${decorInkCount(this.bitmap)} pintados · ${this.undo.length} pasos para deshacer`;
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="undo"]')!.disabled = !this.undo.length;
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="redo"]')!.disabled = !this.redo.length;
  }
}
