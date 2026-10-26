import {
  DECOR_BITMAP_HEIGHT, DECOR_BITMAP_WIDTH, sanitizeDecorBitmap,
} from './LandscapeConfig';
import type { DecorBitmap } from './LandscapeConfig';

export type DecorDrawTool = 'brush' | 'eraser' | 'line' | 'rectangle';
export interface PixelPoint { x: number; y: number }

/** Pure, deterministic bitmap editing with bounded 96x32 monochrome masks. */
export function drawDecorPixels(source: DecorBitmap, tool: DecorDrawTool,
  from: PixelPoint, to: PixelPoint): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  const rows = valid.rows.map(line => line.split(''));
  const clampX = (n: number) => Math.max(0, Math.min(DECOR_BITMAP_WIDTH - 1, Math.round(n)));
  const clampY = (n: number) => Math.max(0, Math.min(DECOR_BITMAP_HEIGHT - 1, Math.round(n)));
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
