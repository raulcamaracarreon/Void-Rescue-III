import {
  decorBitmapHeight, isDecorBitmapWidth, sanitizeDecorBitmap,
} from './LandscapeConfig';
import type { DecorBitmap } from './LandscapeConfig';

export type DecorDrawTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'triangle';
export interface DrawOptions { size?: number; filled?: boolean }
export interface PixelPoint { x: number; y: number }

/** Pixel-inclusive rectangular selection, independent of mask data and drawing history. */
export interface DecorSelection { x: number; y: number; width: number; height: number }

/** Normalize reverse drags and clamp them to the actual bitmap bounds.
 * A click selects one pixel; invalid dimensions/coordinates cannot create selections.
 */
export function normalizeDecorSelection(from: PixelPoint, to: PixelPoint,
  bitmapWidth: number, bitmapHeight: number): DecorSelection | null {
  if (!Number.isInteger(bitmapWidth) || !Number.isInteger(bitmapHeight)
    || bitmapWidth < 1 || bitmapHeight < 1
    || ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  const x0 = Math.max(0, Math.min(bitmapWidth - 1, Math.floor(from.x)));
  const y0 = Math.max(0, Math.min(bitmapHeight - 1, Math.floor(from.y)));
  const x1 = Math.max(0, Math.min(bitmapWidth - 1, Math.floor(to.x)));
  const y1 = Math.max(0, Math.min(bitmapHeight - 1, Math.floor(to.y)));
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0) + 1,
    height: Math.abs(y1 - y0) + 1,
  };
}


/** Clipboard stores only the selected binary rectangle; '0' is transparent
 * when pasted, so underlying ink is not accidentally erased. */
export interface DecorClipboard { width: number; height: number; rows: string[] }

function safeRect(bitmap: DecorBitmap, selection: DecorSelection): DecorSelection | null {
  const { x, y, width, height } = selection;
  if (![x, y, width, height].every(Number.isInteger) || width < 1 || height < 1) return null;
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return null;
  return { x, y, width: Math.min(width, bitmap.width - x),
    height: Math.min(height, bitmap.height - y) };
}

/** Keep the entire region in frame; oversized clips start at (0,0) and
 * will be cropped by the paste operation. */
export function clampDecorOrigin(bitmap: DecorBitmap, width: number, height: number,
  position: PixelPoint): PixelPoint {
  return {
    x: Math.max(0, Math.min(Math.max(0, bitmap.width - width), Math.round(position.x))),
    y: Math.max(0, Math.min(Math.max(0, bitmap.height - height), Math.round(position.y))),
  };
}

export function copyDecorRegion(source: DecorBitmap,
  selection: DecorSelection): DecorClipboard | null {
  const valid = sanitizeDecorBitmap(source);
  const rect = safeRect(valid, selection);
  if (!rect) return null;
  return { width: rect.width, height: rect.height,
    rows: valid.rows.slice(rect.y, rect.y + rect.height)
      .map(row => row.slice(rect.x, rect.x + rect.width)) };
}

export function eraseDecorRegion(source: DecorBitmap, selection: DecorSelection): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  const rect = safeRect(valid, selection);
  if (!rect) return valid;
  const rows = valid.rows.slice();
  const cleared = '0'.repeat(rect.width);
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    const row = rows[y]!;
    rows[y] = row.slice(0, rect.x) + cleared + row.slice(rect.x + rect.width);
  }
  return { ...valid, rows };
}

export function pasteDecorRegion(source: DecorBitmap, clipboard: DecorClipboard,
  position: PixelPoint): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  if (!Number.isInteger(clipboard.width) || !Number.isInteger(clipboard.height)
    || clipboard.width < 1 || clipboard.height < 1
    || clipboard.width > 2048 || clipboard.height > 256
    || clipboard.rows.length !== clipboard.height
    || !clipboard.rows.every(row => row.length === clipboard.width && /^[01]+$/.test(row))
    || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return valid;
  const start = clampDecorOrigin(valid, clipboard.width, clipboard.height, position);
  const rows = valid.rows.slice();
  for (let y = 0; y < clipboard.height && y + start.y < valid.height; y++) {
    const sourceRow = clipboard.rows[y]!;
    const targetRow = rows[y + start.y]!.split('');
    for (let x = 0; x < clipboard.width && x + start.x < valid.width; x++)
      if (sourceRow[x] === '1') targetRow[x + start.x] = '1';
    rows[y + start.y] = targetRow.join('');
  }
  return { ...valid, rows };
}

/** Move takes its ink from a snapshot. Erase happens BEFORE transparent paste,
 * preventing the original location from being restored on overlap. */
export function moveDecorRegion(source: DecorBitmap, selection: DecorSelection,
  position: PixelPoint): DecorBitmap {
  const valid = sanitizeDecorBitmap(source);
  const clipboard = copyDecorRegion(valid, selection);
  const rect = safeRect(valid, selection);
  if (!clipboard || !rect) return valid;
  const target = clampDecorOrigin(valid, rect.width, rect.height, position);
  if (target.x === rect.x && target.y === rect.y) return valid;
  return pasteDecorRegion(eraseDecorRegion(valid, rect), clipboard, target);
}

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

/** Preserve physical aspect when converting between legacy 3:1 drawings and
 * new 8:1 panoramas. Empty space is added on the right, and shorter converted
 * art remains grounded at the bottom of the canvas. Upscaling is nearest-
 * neighbor; downscaling retains any covered pixel so thin lines don't vanish.
 */
export function resizeDecorBitmap(source: DecorBitmap, targetWidth: number): DecorBitmap {
  const original = sanitizeDecorBitmap(source);
  if (!isDecorBitmapWidth(targetWidth) || targetWidth === original.width) return original;
  const targetHeight = decorBitmapHeight(targetWidth);
  const scale = Math.min(targetWidth / original.width, targetHeight / original.height);
  const mappedWidth = Math.max(1, Math.min(targetWidth, Math.round(original.width * scale)));
  const mappedHeight = Math.max(1, Math.min(targetHeight, Math.round(original.height * scale)));
  const yOffset = targetHeight - mappedHeight;
  const rows: string[] = [];

  for (let y = 0; y < targetHeight; y++) {
    if (y < yOffset) { rows.push('0'.repeat(targetWidth)); continue; }
    const sourceMinY = Math.floor((y - yOffset) * original.height / mappedHeight);
    const sourceMaxY = Math.max(sourceMinY + 1,
      Math.ceil((y - yOffset + 1) * original.height / mappedHeight));
    let row = '';
    for (let x = 0; x < targetWidth; x++) {
      if (x >= mappedWidth) { row += '0'.repeat(targetWidth - x); break; }
      const sourceMinX = Math.floor(x * original.width / mappedWidth);
      const sourceMaxX = Math.max(sourceMinX + 1, Math.ceil((x + 1) * original.width / mappedWidth));
      let painted = false;
      for (let sy = sourceMinY; sy < Math.min(original.height, sourceMaxY) && !painted; sy++)
        for (let sx = sourceMinX; sx < Math.min(original.width, sourceMaxX); sx++)
          if (original.rows[sy]![sx] === '1') { painted = true; break; }
      row += painted ? '1' : '0';
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
