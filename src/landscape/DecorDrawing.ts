import {
  decorBitmapHeight, isDecorBitmapWidth, sanitizeDecorBitmap,
} from './LandscapeConfig';
import type { DecorBitmap } from './LandscapeConfig';

export type DecorDrawTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'triangle';
export interface DrawOptions { size?: number; filled?: boolean }
export interface PixelPoint { x: number; y: number }

/** Pure, deterministic bitmap editing with supported 3:1 monochrome masks. */
export function drawDecorPixels(source: DecorBitmap, tool: DecorDrawTool,
  from: PixelPoint, to: PixelPoint, options: DrawOptions = {}): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  const rows = valid.rows.map(line => line.split(''));
  const clampX = (n: number) => Math.max(0, Math.min(valid.width - 1, Math.round(n)));
  const clampY = (n: number) => Math.max(0, Math.min(valid.height - 1, Math.round(n)));
  const x0 = clampX(from.x), y0 = clampY(from.y);
  const x1 = clampX(to.x), y1 = clampY(to.y);
  const ink = tool === 'eraser' ? '0' : '1';
  const size = Math.max(1, Math.min(32, Math.round(options.size ?? 1)));
  const filled = Boolean(options.filled);

  const put = (x: number, y: number): void => {
    const lower = Math.floor((size - 1) / 2), upper = Math.floor(size / 2);
    for (let py = Math.max(0, y - lower); py <= Math.min(valid.height - 1, y + upper); py++) {
      for (let px = Math.max(0, x - lower); px <= Math.min(valid.width - 1, x + upper); px++)
        rows[py]![px] = ink;
    }
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
    if (filled) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        line(Math.min(x0, x1), y, Math.max(x0, x1), y);
    } else {
      line(x0, y0, x1, y0); line(x1, y0, x1, y1);
      line(x1, y1, x0, y1); line(x0, y1, x0, y0);
    }
  } else if (tool === 'circle') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
    const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
    if (filled) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        const span = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
        line(Math.ceil(cx - span), y, Math.floor(cx + span), y);
      }
    } else {
      const steps = Math.max(24, Math.ceil(Math.PI * Math.max(rx, ry) * 4));
      let lastX = Math.round(cx + rx), lastY = Math.round(cy);
      for (let i = 1; i <= steps; i++) {
        const theta = i / steps * Math.PI * 2;
        const xx = Math.round(cx + rx * Math.cos(theta));
        const yy = Math.round(cy + ry * Math.sin(theta));
        line(lastX, lastY, xx, yy); lastX = xx; lastY = yy;
      }
    }
  } else if (tool === 'triangle') {
    const points = [{ x: Math.round((x0 + x1) / 2), y: Math.min(y0, y1) },
      { x: Math.min(x0, x1), y: Math.max(y0, y1) },
      { x: Math.max(x0, x1), y: Math.max(y0, y1) }];
    if (filled) return drawDecorPolygon(valid, points, { filled: true, size });
    for (let i = 0; i < 3; i++) {
      const a = points[i]!, b = points[(i + 1) % 3]!;
      line(a.x, a.y, b.x, b.y);
    }
  } else {
    line(x0, y0, x1, y1);
  }
  return { ...valid, rows: rows.map(row => row.join('')) };
}

export function decorInkCount(bitmap: DecorBitmap): number {
  return bitmap.rows.reduce((sum, line) => sum + [...line].filter(bit => bit === '1').length, 0);
}

/** Nearest-neighbor resizing preserves crisp 1-bit art across 3:1 and 8:1 formats.
 * A resolution switch adds an editor undo step, so accidental downsampling can
 * always be reverted without affecting the saved environment.
 */
export function resizeDecorBitmap(source: DecorBitmap, targetWidth: number): DecorBitmap {
  const original = sanitizeDecorBitmap(source);
  if (!isDecorBitmapWidth(targetWidth) || targetWidth === original.width) return original;
  const targetHeight = decorBitmapHeight(targetWidth);
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

/** Polygon fill uses even-odd scanlines and fills precisely inside each segment.
 * Outline-only mode joins vertices with the regular raster line tool.
 */
export function drawDecorPolygon(source: DecorBitmap, points: PixelPoint[],
  options: DrawOptions = { filled: true }): DecorBitmap {
  const mask = sanitizeDecorBitmap(source);
  if (points.length < 3 || points.length > 64) return mask;
  if (!options.filled) {
    let result = mask;
    for (let i = 0; i < points.length; i++)
      result = drawDecorPixels(result, 'line', points[i]!, points[(i + 1) % points.length]!,
        { size: options.size });
    return result;
  }
  const rows = mask.rows.map(row => row.split(''));
  for (let y = 0; y < mask.height; y++) {
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
        crossings.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      for (let x = Math.max(0, Math.ceil(crossings[i]!)); x <= Math.min(mask.width - 1, Math.floor(crossings[i + 1]!)); x++)
        rows[y]![x] = '1';
  }
  return { ...mask, rows: rows.map(row => row.join('')) };
}
