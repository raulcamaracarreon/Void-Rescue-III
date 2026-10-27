import {
  blankDecorBitmap, sanitizeDecorBitmap,
} from '../landscape/LandscapeConfig';
import type { DecorBitmap } from '../landscape/LandscapeConfig';
import { decorInkCount, drawDecorPixels, drawDecorPolygon, normalizeDecorSelection, resizeDecorBitmap } from '../landscape/DecorDrawing';
import type { DecorDrawTool, DecorSelection, PixelPoint } from '../landscape/DecorDrawing';

/** Small self-contained raster editor. Editing the draft does not mutate saved styles
 * until Aplicar is pressed; Cancelar discards it entirely. */
export class DecorPaintEditor {
  private readonly dialog: HTMLDialogElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tool: HTMLSelectElement;
  private readonly resolution: HTMLSelectElement;
  private readonly zoom: HTMLSelectElement;
  private readonly brushSize: HTMLInputElement;
  private readonly brushValue: HTMLElement;
  private readonly filled: HTMLInputElement;
  private readonly polygonButton: HTMLButtonElement;
  private readonly deselectButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  /** UI-only overlay: never persisted in landscapes or counted in drawing history. */
  private selection: DecorSelection | null = null;
  private selectionBeforeDrag: DecorSelection | null = null;
  private polygon: PixelPoint[] = [];
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
      <p class="landscape-help">Panorama de hasta 400 unidades de ancho: el juego repite el motivo solo al finalizarlo. Selecciona zoom para detallar; desplázate horizontalmente por el lienzo. El dibujo no genera colisiones.</p>
      <div class="decor-paint-toolbar">
        <label>Resolución del lienzo
          <select class="decor-paint-resolution" aria-label="Resolución del lienzo">
            <option value="96">96 × 32 (baja)</option>
            <option value="192">192 × 64 (media)</option>
            <option value="288">288 × 96 (inicial)</option>
            <option value="384">384 × 128 (anterior)</option>
            <option value="512">512 × 64 (panorama básico)</option>
            <option value="1024">1024 × 128 (panorama)</option>
            <option value="2048">2048 × 256 (máxima, inicial)</option>
          </select>
        </label>
        <label>Herramienta
          <select class="decor-paint-tool" aria-label="Herramienta de dibujo">
            <option value="brush">Pincel</option>
            <option value="eraser">Borrador</option>
            <option value="line">Línea</option>
            <option value="rectangle">Rectángulo</option>
            <option value="circle">Círculo / elipse</option>
            <option value="triangle">Triángulo</option>
            <option value="polygon">Polígono por vértices</option>
            <option value="select">Seleccionar región</option>
          </select>
        </label>
        <label>Grosor
          <input type="range" class="decor-paint-brush" min="1" max="32" value="6" aria-label="Grosor del pincel">
          <span class="decor-paint-brush-value" aria-live="off">6 px</span>
        </label>
        <label>Rellenar figura <input type="checkbox" class="decor-paint-filled" aria-label="Rellenar figura" checked></label>
        <label>Zoom
          <select class="decor-paint-zoom" aria-label="Zoom del lienzo">
            <option value="1">1× · encajar</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
            <option value="8">8×</option>
          </select>
        </label>
        <button type="button" data-paint="zoom-out" aria-label="Alejar lienzo">−</button>
        <button type="button" data-paint="zoom-in" aria-label="Acercar lienzo">+</button>
        <button type="button" data-paint="polygon-close" disabled>Cerrar polígono</button>
        <button type="button" data-paint="selection-cancel" disabled>Cancelar selección</button>
        <button type="button" data-paint="undo">Deshacer</button>
        <button type="button" data-paint="redo">Rehacer</button>
        <button type="button" data-paint="clear">Limpiar</button>
      </div>
      <div class="decor-paint-viewport" role="region" aria-label="Área desplazable del dibujo" tabindex="0">
        <canvas class="decor-paint-canvas" width="2048" height="256" aria-label="Lienzo de dibujo de silueta" tabindex="0"></canvas>
      </div>
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
    this.resolution = this.dialog.querySelector<HTMLSelectElement>('.decor-paint-resolution')!;
    this.zoom = this.dialog.querySelector<HTMLSelectElement>('.decor-paint-zoom')!;
    this.brushSize = this.dialog.querySelector<HTMLInputElement>('.decor-paint-brush')!;
    this.brushValue = this.dialog.querySelector<HTMLElement>('.decor-paint-brush-value')!;
    this.filled = this.dialog.querySelector<HTMLInputElement>('.decor-paint-filled')!;
    this.polygonButton = this.dialog.querySelector<HTMLButtonElement>('[data-paint="polygon-close"]')!;
    this.deselectButton = this.dialog.querySelector<HTMLButtonElement>('[data-paint="selection-cancel"]')!;
    this.deselectButton.addEventListener('click', () => this.cancelSelection());
    this.brushSize.addEventListener('input', () => {
      this.brushValue.textContent = `${this.brushSize.value} px`;
    });
    this.tool.addEventListener('change', () => {
      this.polygon = [];
      // Until manipulations are implemented, a selection does not clip other tools.
      // Switching tools clears the selection to avoid misleading the user.
      this.selection = null;
      this.selectionBeforeDrag = null;
      this.paint();
    });
    this.zoom.addEventListener('change', () => this.changeZoom(Number(this.zoom.value)));
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="zoom-in"]')!.addEventListener('click',
      () => this.changeZoom(Math.min(8, Number(this.zoom.value) * 2)));
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="zoom-out"]')!.addEventListener('click',
      () => this.changeZoom(Math.max(1, Number(this.zoom.value) / 2)));
    this.polygonButton.addEventListener('click', () => this.finishPolygon());
    this.resolution.addEventListener('change', () => {
      if (this.pointer !== null) {
        this.resolution.value = String(this.bitmap.width);
        return;
      }
      const requested = Number(this.resolution.value);
      if (requested === this.bitmap.width) return;
      this.snapshotForUndo();
      this.bitmap = resizeDecorBitmap(this.bitmap, requested);
      this.polygon = [];
      this.selection = null;
      this.selectionBeforeDrag = null;
      this.paint();
    });
    this.status = this.dialog.querySelector<HTMLElement>('.decor-paint-status')!;

    this.canvas.addEventListener('pointerdown', event => {
      if (this.pointer !== null || event.button !== 0) return;
      event.preventDefault();
      this.start = this.point(event);
      this.last = this.start;
      if (this.tool.value === 'polygon') {
        // Separate clicks mark vertices. A dedicated button finishes and fills it.
        this.polygon.push(this.start);
        if (this.polygon.length > 64) this.polygon.shift();
        this.paint();
        return;
      }
      if (this.tool.value === 'select') {
        this.selectionBeforeDrag = this.selection;
        this.selection = normalizeDecorSelection(this.start, this.start,
          this.bitmap.width, this.bitmap.height);
        this.pointer = event.pointerId;
        this.canvas.setPointerCapture(event.pointerId);
        this.paint();
        return;
      }
      this.pointer = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.snapshot = sanitizeDecorBitmap(this.bitmap);
      this.bitmap = drawDecorPixels(this.bitmap, this.tool.value as DecorDrawTool,
        this.start, this.start, this.drawOptions());
      this.paint();
    });
    this.canvas.addEventListener('pointermove', event => {
      if (this.pointer !== event.pointerId) return;
      event.preventDefault();
      if (this.tool.value === 'select') {
        this.selection = normalizeDecorSelection(this.start, this.point(event),
          this.bitmap.width, this.bitmap.height);
        this.paint();
      } else this.extend(event);
    });
    this.canvas.addEventListener('pointerup', event => {
      if (this.pointer !== event.pointerId) return;
      if (this.tool.value === 'select') {
        this.selection = normalizeDecorSelection(this.start, this.point(event),
          this.bitmap.width, this.bitmap.height);
        this.selectionBeforeDrag = null;
        this.pointer = null;
        if (this.canvas.hasPointerCapture(event.pointerId))
          this.canvas.releasePointerCapture(event.pointerId);
        this.paint();
        return;
      }
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
      if (this.tool.value === 'select') {
        this.selection = this.selectionBeforeDrag;
        this.selectionBeforeDrag = null;
      } else if (this.snapshot) this.bitmap = this.snapshot;
      this.pointer = null; this.snapshot = null; this.paint();
    });

    this.dialog.querySelector<HTMLButtonElement>('[data-paint="undo"]')!.addEventListener('click', () => this.stepBack());
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="redo"]')!.addEventListener('click', () => this.stepForward());
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="clear"]')!.addEventListener('click', () => {
      if (decorInkCount(this.bitmap) === 0) return;
      this.snapshotForUndo();
      this.polygon = [];
      this.bitmap = blankDecorBitmap(this.bitmap.width);
      this.selection = null;
      this.paint();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="apply"]')!.addEventListener('click', () => {
      this.onApply?.(sanitizeDecorBitmap(this.bitmap));
      this.close();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="cancel"]')!.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      // Native dialog cancellation (for example, platform back button).
      if (this.selection) this.cancelSelection();
      else this.close();
    });
    // Handle Escape in capture phase: native <select> controls may consume the
    // key without dispatching dialog.cancel after a zoom/resolution change.
    // Explicitly handle the first Escape as deselect and the next as close.
    this.dialog.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.selection) this.cancelSelection();
      else this.close();
    }, { capture: true });
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
    this.polygon = [];
    this.selection = null;
    this.selectionBeforeDrag = null;
    this.onApply = apply;
    this.tool.value = 'brush';
    this.resolution.value = String(this.bitmap.width);
    // Fit the whole panorama at opening so pointer interactions reach every part
    // of the bitmap. Users may then zoom in explicitly to edit fine detail.
    this.changeZoom(1);
    this.dialog.querySelector<HTMLElement>('.decor-paint-viewport')!.scrollTo({ left: 0, top: 0 });
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
    this.polygon = [];
    this.selection = null;
    this.selectionBeforeDrag = null;
    this.onApply = null;
  }

  private point(event: PointerEvent): PixelPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(this.bitmap.width - 1,
        Math.floor((event.clientX - rect.left) / rect.width * this.bitmap.width))),
      y: Math.max(0, Math.min(this.bitmap.height - 1,
        Math.floor((event.clientY - rect.top) / rect.height * this.bitmap.height))),
    };
  }

  private extend(event: PointerEvent): void {
    const next = this.point(event);
    const tool = this.tool.value as DecorDrawTool;
    if (tool === 'brush' || tool === 'eraser') {
      // Only freehand tools accumulate segments between successive pointer positions.
      this.bitmap = drawDecorPixels(this.bitmap, tool, this.last, next, this.drawOptions());
    } else {
      // Every geometric figure is recalculated from pointerdown, not stamped like a brush.
      // This includes circle and triangle (which previously fell into the freehand path).
      this.bitmap = drawDecorPixels(this.snapshot!, tool, this.start, next, this.drawOptions());
    }
    this.last = next;
    this.paint();
  }

  private stepBack(): void {
    this.polygon = [];
    this.selection = null;
    const last = this.undo.pop();
    if (!last) return;
    this.redo.push(this.bitmap);
    this.bitmap = last;
    this.paint();
  }

  private stepForward(): void {
    this.polygon = [];
    this.selection = null;
    const next = this.redo.pop();
    if (!next) return;
    this.undo.push(this.bitmap);
    this.bitmap = next;
    this.paint();
  }

  private drawOptions(): { size: number; filled: boolean } {
    return { size: Number(this.brushSize.value), filled: this.filled.checked };
  }

  private snapshotForUndo(): void {
    this.undo.push(sanitizeDecorBitmap(this.bitmap));
    if (this.undo.length > 30) this.undo.shift();
    this.redo = [];
  }

  private finishPolygon(): void {
    if (this.polygon.length < 3) return;
    this.snapshotForUndo();
    this.bitmap = drawDecorPolygon(this.bitmap, this.polygon, this.drawOptions());
    this.polygon = [];
    this.paint();
  }

  private cancelSelection(): void {
    this.selection = null;
    this.selectionBeforeDrag = null;
    this.paint();
  }

  private changeZoom(value: number): void {
    const zoom = [1, 2, 4, 8].includes(value) ? value : 1;
    this.zoom.value = String(zoom);
    this.canvas.style.width = `${zoom * 100}%`;
  }

  private paint(): void {
    this.resolution.value = String(this.bitmap.width);
    // Canvas dimensions are the actual bitmap pixels, independent of zoom.
    this.canvas.width = this.bitmap.width;
    this.canvas.height = this.bitmap.height;
    const stepX = 1, stepY = 1;
    this.ctx.fillStyle = '#082024';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#a4f5d6';
    for (let y = 0; y < this.bitmap.height; y++) {
      const row = this.bitmap.rows[y]!;
      let pos = row.indexOf('1');
      while (pos !== -1) {
        let last = pos + 1;
        while (last < row.length && row[last] === '1') last++;
        this.ctx.fillRect(pos, y, last - pos, 1);
        pos = row.indexOf('1', last);
      }
    }
    // Show pending vertices without changing the saved mask.
    if (this.polygon.length) {
      this.ctx.strokeStyle = '#ffdf77';
      this.ctx.lineWidth = Math.max(1, this.bitmap.width / 1024);
      this.ctx.beginPath();
      this.polygon.forEach((pt, i) => i ? this.ctx.lineTo(pt.x, pt.y) : this.ctx.moveTo(pt.x, pt.y));
      this.ctx.stroke();
    }
    this.ctx.strokeStyle = '#43706b50';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= this.bitmap.width; x += Math.max(8, Math.round(this.bitmap.width / 24))) {
      this.ctx.moveTo(x * stepX + 0.5, 0);
      this.ctx.lineTo(x * stepX + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.bitmap.height; y += Math.max(8, Math.round(this.bitmap.height / 8))) {
      this.ctx.moveTo(0, y * stepY + 0.5);
      this.ctx.lineTo(this.canvas.width, y * stepY + 0.5);
    }
    this.ctx.stroke();
    if (this.selection) {
      // A dashed overlay is visible at any zoom but never affects the bitmap.
      const selected = this.selection;
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 215, 99, 0.13)';
      this.ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
      this.ctx.strokeStyle = '#ffe27c';
      this.ctx.lineWidth = Math.max(1, this.bitmap.width / 1024);
      this.ctx.setLineDash([Math.max(2, this.bitmap.width / 512), Math.max(2, this.bitmap.width / 512)]);
      this.ctx.strokeRect(selected.x + 0.5, selected.y + 0.5,
        Math.max(0, selected.width - 1), Math.max(0, selected.height - 1));
      this.ctx.restore();
    }
    const selText = this.selection
      ? ` · selección x=${this.selection.x}, y=${this.selection.y} · ${this.selection.width} × ${this.selection.height} px`
      : '';
    this.status.textContent = `${this.bitmap.width} × ${this.bitmap.height} píxeles · ${decorInkCount(this.bitmap)} pintados · ${this.undo.length} pasos para deshacer${selText}`;
    this.polygonButton.disabled = this.polygon.length < 3;
    this.deselectButton.disabled = !this.selection;
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="undo"]')!.disabled = !this.undo.length;
    this.dialog.querySelector<HTMLButtonElement>('[data-paint="redo"]')!.disabled = !this.redo.length;
  }
}
