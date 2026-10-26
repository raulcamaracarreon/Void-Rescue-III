import {
  isDecorBitmapWidth, sanitizeDecorBitmap,
} from './LandscapeConfig';
import type { DecorBitmap } from './LandscapeConfig';

export type DecorDrawTool = 'brush' | 'eraser' | 'line' | 'rectangle';
export interface PixelPoint { x: number; y: number }

/** Pure, deterministic bitmap editing with supported 3:1 monochrome masks. */
export function drawDecorPixels(source: DecorBitmap, tool: DecorDrawTool,
  from: PixelPoint, to: PixelPoint): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  const rows = valid.rows.map(line => line.split(''));
  const clampX = (n: number) => Math.max(0, Math.min(valid.width - 1, Math.round(n)));
  const clampY = (n: number) => Math.max(0, Math.min(valid.height - 1, Math.round(n)));
  const x0 = clampX(from.x), y0 = clampY(from.y);
  const x1 = clampX(to.x), y1 = clampY(to.y);
  const ink = tool === 'eraser' ? '0' : '1';

  const put = (x: number, y: number): void => {
    rows[y]![x] = ink;
  };
  const line = (ax: number, ay: number, bx: number, by: number): void => {
    let x = ax, y = ay;
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let error = dx - dy;
    for (;;) {
      put(x, y);
      if (x === bx && y === by) break;
      const twice = 2 * error;
      if (twice > -dy) { error -= dy; x += sx; }
      if (twice < dx) { error += dx; y += sy; }
    }
  };
  if (tool === 'rectangle') {
    line(x0, y0, x1, y0);
    line(x1, y0, x1, y1);
    line(x1, y1, x0, y1);
    line(x0, y1, x0, y0);
  } else {
    line(x0, y0, x1, y1);
  }
  return { ...valid, rows: rows.map(row => row.join('')) };
}

export function decorInkCount(bitmap: DecorBitmap): number {
  return bitmap.rows.reduce((sum, line) => sum + [...line].filter(bit => bit === '1').length, 0);
}

/** Nearest-neighbor resizing preserves crisp 1-bit art and the 3:1 motif ratio.
 * A resolution switch adds an editor undo step, so accidental downsampling can
 * always be reverted without affecting the saved environment.
 */
export function resizeDecorBitmap(source: DecorBitmap, targetWidth: number): DecorBitmap {
  const original = sanitizeDecorBitmap(source);
  if (!isDecorBitmapWidth(targetWidth) || targetWidth === original.width) return original;
  const targetHeight = targetWidth / 3;
  const rows: string[] = [];
  for (let y = 0; y < targetHeight; y++) {
    const oldY = Math.min(original.height - 1, Math.floor(y * original.height / targetHeight));
    const sourceRow = original.rows[oldY]!;
    let row = '';
    for (let x = 0; x < targetWidth; x++) {
      const oldX = Math.min(original.width - 1, Math.floor(x * original.width / targetWidth));
      row += sourceRow[oldX]!;
    }
    rows.push(row);
  }
  return { version: 1, width: targetWidth, height: targetHeight, rows };
}
