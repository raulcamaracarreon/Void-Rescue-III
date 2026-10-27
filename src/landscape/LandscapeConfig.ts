import { Random } from '../core/Random';

export type LandscapeLayerKind = 'mountains' | 'buildings';
export type LandscapePreset = 'night' | 'city' | 'sunset' | 'ice' | 'volcanic' | 'toxic_swamp'
  | 'copper_desert' | 'neon_megacity' | 'ash_world' | 'amethyst_planet'
  | 'martian_dusk' | 'polar_overcast' | 'strange_planet';
export type LandscapeSelection = 'cycle' | LandscapePreset | 'custom' | `user:${string}`;
export type LandscapeRotation = 'sequential' | 'shuffle';
export type LandscapeEditorMode = 'automatic' | 'advanced';
export type LandscapeComposition = 'mountains' | 'buildings' | 'mixed';

export interface AutomaticLandscape {
  skyColor: string;
  frontColor: string;
  layerCount: number;
  composition: LandscapeComposition;
}

export interface LandscapeLayer {
  type: LandscapeLayerKind;
  color: string;
  amplitude: number;
  detail: number;
}

export type ForegroundKind = 'trees' | 'fence' | 'grille' | 'buildings' | 'drawing';

/** Legacy 3:1 masks are kept untouched. New panoramas use 8:1, allowing
 * an entire screen or more between motif repeats at the reference camera size.
 * 2048×256 is the default for new drawings; 4096×512 is intentionally excluded
 * until storage and GPU limits for huge user libraries are addressed.
 */
export const DECOR_BITMAP_WIDTHS = [96, 192, 288, 384, 512, 1024, 2048] as const;
export type DecorBitmapWidth = (typeof DECOR_BITMAP_WIDTHS)[number];
export const DECOR_BITMAP_WIDTH = 2048;
export const DECOR_BITMAP_HEIGHT = 256;
export function isDecorBitmapWidth(value: unknown): value is DecorBitmapWidth {
  return typeof value === 'number' && DECOR_BITMAP_WIDTHS.some(width => width === value);
}
export function decorBitmapHeight(width: number): number {
  return width <= 384 ? width / 3 : width / 8;
}
export interface DecorBitmap {
  version: 1;
  width: number;
  height: number;
  rows: string[];
}
/** Compact on disk: 1-bit masks are serialized to a fixed-length bitset
 * instead of 500 KB of literal zeroes/ones. The editor still works with v1 rows.
 * The JSON v2 format is internal to VR3 preferences, not user-imported code.
 */
function bitmapWithPackedSerialization(width: number, rows: string[]): DecorBitmap {
  const bitmap: DecorBitmap = { version: 1, width, height: decorBitmapHeight(width), rows };
  Object.defineProperty(bitmap, 'toJSON', {
    enumerable: false,
    value: () => {
      const bytes = new Uint8Array(Math.ceil(width * bitmap.height / 8));
      let index = 0;
      for (const row of bitmap.rows) {
        for (let x = 0; x < width; x++, index++) {
          if (row[x] === '1') bytes[index >> 3]! |= 1 << (7 - (index & 7));
        }
      }
      let chars = '';
      for (let i = 0; i < bytes.length; i += 8192)
        chars += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { version: 2, width, height: bitmap.height, packed: btoa(chars) };
    },
  });
  return bitmap;
}
export function blankDecorBitmap(width: number = DECOR_BITMAP_WIDTH): DecorBitmap {
  const safeWidth = isDecorBitmapWidth(width) ? width : DECOR_BITMAP_WIDTH;
  return bitmapWithPackedSerialization(safeWidth,
    Array.from({ length: decorBitmapHeight(safeWidth) }, () => '0'.repeat(safeWidth)));
}
export function sanitizeDecorBitmap(value: unknown): DecorBitmap {
  const fallback = blankDecorBitmap();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const v = value as Record<string, unknown>;
  if (!isDecorBitmapWidth(v.width) || v.height !== decorBitmapHeight(v.width)) return fallback;
  const width = v.width;
  if (v.version === 2) {
    const length = Math.ceil(width * v.height / 8);
    if (typeof v.packed !== 'string' || v.packed.length !== Math.ceil(length / 3) * 4
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(v.packed)) return fallback;
    try {
      const binary = atob(v.packed);
      if (binary.length !== length) return fallback;
      const rows: string[] = [];
      for (let y = 0; y < v.height; y++) {
        let line = '';
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          line += (binary.charCodeAt(index >> 3) & (1 << (7 - (index & 7)))) ? '1' : '0';
        }
        rows.push(line);
      }
      return bitmapWithPackedSerialization(width, rows);
    } catch {
      return fallback;
    }
  }
  if (v.version !== 1 || !Array.isArray(v.rows) || v.rows.length !== v.height) return fallback;
  return bitmapWithPackedSerialization(width,
    v.rows.map(row => typeof row === 'string' && row.length === width
      && /^[01]+$/.test(row) ? row : '0'.repeat(width)));
}

/** Common configuration for both editable decorative depth planes. */
export type DecorColorMode = 'manual' | 'gradient';
export interface DecorLayerConfig {
  enabled: boolean;
  kind: ForegroundKind;
  /** Manual swatch, preserved even when the automatic gradient is selected. */
  color: string;
  colorMode: DecorColorMode;
  invertGradient: boolean;
  opacity: number;
  parallax: number;
  /** Decorated portion of the wrapped world, in percent (5..100). Objects keep their size. */
  spanPercent: number;
  /** Raster silhouette is optional, so legacy and procedural environments stay compact. */
  bitmap?: DecorBitmap;
}
/** Kept as an alias for existing foreground callers and tests. */
export type ForegroundConfig = DecorLayerConfig;

export const DEFAULT_FOREGROUND: Readonly<DecorLayerConfig> = Object.freeze({
  enabled: false, kind: 'trees', color: '#172b29', colorMode: 'manual', invertGradient: false,
  opacity: 0.48, parallax: 1.12, spanPercent: 100,
});
export const DEFAULT_MIDGROUND: Readonly<DecorLayerConfig> = Object.freeze({
  enabled: false, kind: 'trees', color: '#304b42', colorMode: 'manual', invertGradient: false,
  opacity: 0.62, parallax: 0.75, spanPercent: 100,
});

export interface LandscapeStyle {
  skyTop: string;
  skyBottom: string;
  stars: boolean;
  moon: boolean;
  seed: number;
  layers: LandscapeLayer[];
  foreground?: DecorLayerConfig;
  midground?: DecorLayerConfig;
  automatic?: AutomaticLandscape;
  advancedEdited?: boolean;
}

export interface SavedLandscape {
  id: string;
  name: string;
  mode: LandscapeEditorMode;
  style: LandscapeStyle;
}
export interface LandscapePreferences {
  selection: LandscapeSelection;
  mode: LandscapeEditorMode;
  custom: LandscapeStyle;
  library: SavedLandscape[];
  cyclePool: string[];
  rotation: LandscapeRotation;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const PRESET_ORDER: LandscapePreset[] = [
  'night', 'city', 'sunset', 'ice', 'volcanic', 'toxic_swamp', 'copper_desert',
  'neon_megacity', 'ash_world', 'amethyst_planet', 'martian_dusk',
  'polar_overcast', 'strange_planet',
];
function makePreset(sky: string, front: string, composition: LandscapeComposition,
  seed: number, stars = false, moon = false): LandscapeStyle {
  return {
    skyTop: sky, skyBottom: sky, seed, stars, moon,
    automatic: { skyColor: sky, frontColor: front, layerCount: 6, composition },
    layers: Array.from({ length: 6 }, (_, index) => ({
      type: composition === 'mixed' ? index % 3 === 2 ? 'buildings' : 'mountains' : composition,
      color: mixLandscapeColors(sky, front, (index + 1) / 6),
      amplitude: Math.round(6 + 20 * index / 5), detail: Math.round(12 + 73 * index / 5),
    })),
  };
}

export const LANDSCAPE_PRESETS: Record<LandscapePreset, { label: string; style: LandscapeStyle }> = {
  night: { label: 'Noche estelar', style: {
    skyTop: '#020509', skyBottom: '#142b3c', stars: true, moon: true, seed: 11,
    layers: [
      { type: 'mountains', color: '#20354d', amplitude: 17, detail: 28 },
      { type: 'mountains', color: '#1a3551', amplitude: 20, detail: 41 },
      { type: 'mountains', color: '#163849', amplitude: 13, detail: 56 },
      { type: 'mountains', color: '#102632', amplitude: 9, detail: 66 },
    ],
  } },
  city: { label: 'Ciudad abandonada', style: {
    skyTop: '#060817', skyBottom: '#3c305c', stars: true, moon: true, seed: 27,
    layers: [
      { type: 'mountains', color: '#2d2d58', amplitude: 12, detail: 29 },
      { type: 'buildings', color: '#282645', amplitude: 20, detail: 39 },
      { type: 'mountains', color: '#20253c', amplitude: 9, detail: 53 },
      { type: 'buildings', color: '#141c33', amplitude: 14, detail: 70 },
    ],
  } },
  sunset: { label: 'Ocaso alienígena', style: {
    skyTop: '#301938', skyBottom: '#b96a63', stars: false, moon: false, seed: 43,
    layers: [
      { type: 'mountains', color: '#80546e', amplitude: 14, detail: 28 },
      { type: 'mountains', color: '#69445e', amplitude: 19, detail: 40 },
      { type: 'mountains', color: '#4a3552', amplitude: 12, detail: 58 },
      { type: 'buildings', color: '#28263f', amplitude: 13, detail: 39 },
    ],
  } },
  ice: { label: 'Mundo glacial', style: {
    skyTop: '#1e4a68', skyBottom: '#77b7c6', stars: false, moon: false, seed: 59,
    layers: [
      { type: 'mountains', color: '#74a8b9', amplitude: 22, detail: 33 },
      { type: 'mountains', color: '#4e879e', amplitude: 17, detail: 49 },
      { type: 'mountains', color: '#32647d', amplitude: 13, detail: 60 },
      { type: 'mountains', color: '#1c425c', amplitude: 10, detail: 76 },
    ],
  } },
  volcanic: { label: 'Mundo volcánico', style: makePreset('#f87c26', '#361714', 'mountains', 73) },
  toxic_swamp: { label: 'Pantano tóxico', style: makePreset('#c6f566', '#143c37', 'mixed', 87) },
  copper_desert: { label: 'Desierto de cobre', style: makePreset('#f5d5a0', '#794127', 'mountains', 101) },
  neon_megacity: { label: 'Metrópolis neón', style: makePreset('#3355ae', '#170f51', 'buildings', 115, true) },
  ash_world: { label: 'Mundo de cenizas', style: makePreset('#a3a7ac', '#272b35', 'mixed', 129) },
  amethyst_planet: { label: 'Planeta amatista', style: makePreset('#bd9be2', '#402165', 'mountains', 143) },
  // User-provided references: orange/red Martian, foggy polar blue-gray and magenta alien.
  martian_dusk: { label: 'Ocaso Marciano', style: makePreset('#ef4d25', '#482a0f', 'mixed', 157) },
  polar_overcast: { label: 'Nublado Polar', style: makePreset('#fafafa', '#46527c', 'mixed', 171) },
  strange_planet: { label: 'Planeta extraño', style: makePreset('#f92fc3', '#481043', 'mixed', 185) },
};

/** RGB interpolation matches the original Landscape Generator's mix(a,b,t) exactly. */
export function mixLandscapeColors(sky: string, front: string, t: number): string {
  const amount = Math.max(0, Math.min(1, t));
  const components = [1, 3, 5].map(index => {
    const a = Number.parseInt(sky.slice(index, index + 2), 16);
    const b = Number.parseInt(front.slice(index, index + 2), 16);
    return Math.round(a * (1 - amount) + b * amount).toString(16).padStart(2, '0');
  });
  return '#' + components.join('');
}

/** Decorative colors are TWO NEW gradient steps beyond the closest background,
 * not samples that duplicate an already-visible mountain/building layer.
 *
 * When auto-generated, the background palette reserves two of its original RGB
 * steps for decor, keeping all requested colors within the user-selected gamut.
 * The signed contrast is always darker toward the viewer; inverse is lighter.
 * In the reverse direction we use half-step positions to avoid repeating an
 * existing background color (notably the penultimate mountain).
 *
 * For advanced/custom palettes, use the actual last two visible layers as the
 * source of the step. Never mutate the stored manual color or background colors.
 */
export function decorColorForStyle(style: LandscapeStyle, plane: 'foreground' | 'midground'): string {
  const decor = style[plane] ?? (plane === 'foreground' ? DEFAULT_FOREGROUND : DEFAULT_MIDGROUND);
  if (decor.colorMode !== 'gradient') return decor.color;
  const nearest = style.layers.at(-1)?.color ?? style.automatic?.frontColor ?? style.skyBottom;
  const previous = style.layers.at(-2)?.color ?? style.automatic?.skyColor ?? style.skyTop;
  const rgb = (hex: string): number[] => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  const near = rgb(nearest);
  const prev = rgb(previous);
  const luminance = (channels: number[]): number =>
    channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  // If contrast runs opposite to the original background gradient, offset
  // the extrapolation beyond whole steps to avoid the penultimate layer.
  const backgroundGetsDarker = luminance(near) < luminance(prev);
  const distance = plane === 'midground' ? 1 : 2;
  const sameDirection = decor.invertGradient ? !backgroundGetsDarker : backgroundGetsDarker;
  const stepCount = sameDirection ? distance : distance + 0.5;
  const direction = decor.invertGradient ? 1 : -1;
  const auto = style.automatic;
  // For an automatically rebuilt palette, the original two user-selected
  // endpoints are strict bounds even if rounding makes a new step overshoot.
  // Advanced hand-painted palettes are never constrained by unrelated stops.
  const reservedAutoPalette = Boolean(auto && style.layers.length === auto.layerCount
    && nearest === mixLandscapeColors(auto.skyColor, auto.frontColor,
      auto.layerCount / (auto.layerCount + 2)));
  const selectedStart = reservedAutoPalette ? rgb(auto!.skyColor) : [0, 0, 0];
  const selectedEnd = reservedAutoPalette ? rgb(auto!.frontColor) : [255, 255, 255];
  return '#' + near.map((component, i) => {
    const delta = Math.abs(component - prev[i]!);
    // A flat channel remains unchanged: no fictitious hue is introduced.
    const lower = Math.min(selectedStart[i]!, selectedEnd[i]!);
    const upper = Math.max(selectedStart[i]!, selectedEnd[i]!);
    const extended = Math.max(lower, Math.min(upper,
      Math.round(component + direction * delta * stepCount)));
    return extended.toString(16).padStart(2, '0');
  }).join('');
}

const AUTO_PRESETS: Record<LandscapePreset, AutomaticLandscape> = {
  night: { skyColor: '#020509', frontColor: '#17465a', layerCount: 6, composition: 'mountains' },
  city: { skyColor: '#1d2947', frontColor: '#0a142c', layerCount: 6, composition: 'mixed' },
  sunset: { skyColor: '#e6a0a0', frontColor: '#422b56', layerCount: 6, composition: 'mixed' },
  ice: { skyColor: '#96dbef', frontColor: '#164c78', layerCount: 6, composition: 'mountains' },
  volcanic: { skyColor: '#f87c26', frontColor: '#361714', layerCount: 6, composition: 'mountains' },
  toxic_swamp: { skyColor: '#c6f566', frontColor: '#143c37', layerCount: 6, composition: 'mixed' },
  copper_desert: { skyColor: '#f5d5a0', frontColor: '#794127', layerCount: 6, composition: 'mountains' },
  neon_megacity: { skyColor: '#3355ae', frontColor: '#170f51', layerCount: 6, composition: 'buildings' },
  ash_world: { skyColor: '#a3a7ac', frontColor: '#272b35', layerCount: 6, composition: 'mixed' },
  amethyst_planet: { skyColor: '#bd9be2', frontColor: '#402165', layerCount: 6, composition: 'mountains' },
  martian_dusk: { skyColor: '#ef4d25', frontColor: '#482a0f', layerCount: 6, composition: 'mixed' },
  polar_overcast: { skyColor: '#fafafa', frontColor: '#46527c', layerCount: 6, composition: 'mixed' },
  strange_planet: { skyColor: '#f92fc3', frontColor: '#481043', layerCount: 6, composition: 'mixed' },
};

export function copyLandscape(style: LandscapeStyle): LandscapeStyle {
  return {
    ...style,
    layers: style.layers.map(layer => ({ ...layer })),
    ...(style.foreground ? { foreground: {
      ...style.foreground,
      ...(style.foreground.bitmap ? { bitmap: sanitizeDecorBitmap(style.foreground.bitmap) } : {}),
    } } : {}),
    ...(style.midground ? { midground: {
      ...style.midground,
      ...(style.midground.bitmap ? { bitmap: sanitizeDecorBitmap(style.midground.bitmap) } : {}),
    } } : {}),
    ...(style.automatic ? { automatic: { ...style.automatic } } : {}),
  };
}

function copyAutomatic(config: AutomaticLandscape): AutomaticLandscape { return { ...config }; }

export function buildAutomaticLandscape(base: LandscapeStyle, config: AutomaticLandscape): LandscapeStyle {
  const count = config.layerCount;
  // The selected two colors now span N background layers PLUS two additional
  // decor tones whenever at least one decorative plane uses automatic color.
  // Old manual-color environments retain their exact original background colors.
  const gradientDecorEnabled = (base.foreground?.enabled && base.foreground.colorMode === 'gradient')
    || (base.midground?.enabled && base.midground.colorMode === 'gradient');
  const paletteSteps = count + (gradientDecorEnabled ? 2 : 0);
  const layers: LandscapeLayer[] = Array.from({ length: count }, (_, index) => {
    const depth = count === 1 ? 1 : index / (count - 1);
    const type: LandscapeLayerKind = config.composition === 'mixed'
      ? (index % 3 === 2 ? 'buildings' : 'mountains') : config.composition;
    return {
      type,
      // Reserve two more RGB steps for the third and first plane, if needed.
      color: mixLandscapeColors(config.skyColor, config.frontColor, (index + 1) / paletteSteps),
      amplitude: Math.round(6 + 20 * depth),
      detail: Math.round(12 + 73 * depth),
    };
  });
  return {
    ...copyLandscape(base),
    skyTop: config.skyColor,
    skyBottom: config.skyColor,
    automatic: copyAutomatic(config),
    layers,
  };
}

export function defaultLandscapePreferences(): LandscapePreferences {
  return {
    selection: 'cycle',
    mode: 'automatic',
    custom: { ...copyLandscape(LANDSCAPE_PRESETS.night.style),
      foreground: { ...DEFAULT_FOREGROUND }, midground: { ...DEFAULT_MIDGROUND },
      automatic: copyAutomatic(AUTO_PRESETS.night), advancedEdited: false },
    library: [],
    cyclePool: [...PRESET_ORDER],
    rotation: 'sequential',
  };
}

export function isSavedLandscapeId(id: string): boolean {
  return /^user:[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export function allLandscapeChoices(preferences: LandscapePreferences): { id: string; label: string }[] {
  return [
    ...PRESET_ORDER.map(id => ({ id, label: LANDSCAPE_PRESETS[id].label })),
    ...preferences.library.map(item => ({ id: `user:${item.id}`, label: item.name })),
  ];
}

function shuffleCycle(pool: string[], seed: number, cycle: number): string[] {
  const result = [...pool];
  const generator = new Random((seed ^ Math.imul(cycle + 1, 0x9e3779b9) ^ 0x43bc157a) >>> 0);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(generator.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  if (cycle > 0 && result.length > 1) {
    const previous = shuffleCycle(pool, seed, cycle - 1).at(-1);
    if (result[0] === previous) {
      const swap = result.findIndex(id => id !== previous);
      [result[0], result[swap]] = [result[swap]!, result[0]!];
    }
  }
  return result;
}

/** Every landscape appears once per cycle. The shuffle uses game seed and block number,
 * never simulation RNG, and prevents duplicates between consecutive blocks. */
export function landscapeForWave(preferences: LandscapePreferences, wave: number, gameSeed = 0): string {
  const valid = new Set(allLandscapeChoices(preferences).map(choice => choice.id));
  const pool = preferences.cyclePool.filter(id => valid.has(id));
  // If everything is unchecked, keep a safe first preset without modifying saved settings.
  if (pool.length === 0) return 'night';
  const n = Math.max(1, Math.floor(wave)) - 1;
  const cycle = Math.floor(n / pool.length), index = n % pool.length;
  return preferences.rotation === 'shuffle' ? shuffleCycle(pool, gameSeed, cycle)[index]! : pool[index]!;
}

export function resolveLandscape(preferences: LandscapePreferences, wave: number, gameSeed = 0): { name: string; style: LandscapeStyle } {
  const selected = preferences.selection === 'cycle'
    ? landscapeForWave(preferences, wave, gameSeed) : preferences.selection;
  if (selected === 'custom') {
    const custom = copyLandscape(preferences.custom);
    return { name: 'Personalizado', style: preferences.mode === 'automatic'
      ? buildAutomaticLandscape(custom, custom.automatic ?? AUTO_PRESETS.night) : custom };
  }
  if (isSavedLandscapeId(selected)) {
    const saved = preferences.library.find(item => `user:${item.id}` === selected);
    if (saved) {
      const style = copyLandscape(saved.style);
      return { name: saved.name, style: saved.mode === 'automatic'
        ? buildAutomaticLandscape(style, style.automatic ?? AUTO_PRESETS.night) : style };
    }
  }
  const key = Object.hasOwn(LANDSCAPE_PRESETS, selected) ? selected as LandscapePreset : 'night';
  const source = { ...copyLandscape(LANDSCAPE_PRESETS[key].style), automatic: copyAutomatic(AUTO_PRESETS[key]) };
  return { name: LANDSCAPE_PRESETS[key].label, style: preferences.mode === 'automatic'
    ? buildAutomaticLandscape(source, AUTO_PRESETS[key]) : source };
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback;
}
function int(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

function sanitizeAutomatic(value: unknown, fallback: AutomaticLandscape): AutomaticLandscape {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return copyAutomatic(fallback);
  const v = value as Record<string, unknown>;
  return {
    skyColor: color(v.skyColor, fallback.skyColor),
    frontColor: color(v.frontColor, fallback.frontColor),
    layerCount: int(v.layerCount, 2, 10, fallback.layerCount),
    composition: v.composition === 'mountains' || v.composition === 'buildings' || v.composition === 'mixed'
      ? v.composition : fallback.composition,
  };
}

function sanitizeDecor(value: unknown, fallback: DecorLayerConfig,
  minParallax: number, maxParallax: number): DecorLayerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fallback };
  const v = value as Record<string, unknown>;
  const bounded = (candidate: unknown, min: number, max: number, previous: number): number =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(min, Math.min(max, candidate)) : previous;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : fallback.enabled,
    kind: v.kind === 'trees' || v.kind === 'fence' || v.kind === 'grille'
      || v.kind === 'buildings' || v.kind === 'drawing' ? v.kind : fallback.kind,
    color: color(v.color, fallback.color),
    // Existing saved environments have no colorMode: keep their original manual colors.
    colorMode: v.colorMode === 'gradient' ? 'gradient' : 'manual',
    invertGradient: typeof v.invertGradient === 'boolean' ? v.invertGradient : false,
    opacity: bounded(v.opacity, 0.1, 1, fallback.opacity),
    parallax: bounded(v.parallax, minParallax, maxParallax, fallback.parallax),
    spanPercent: Math.round(bounded(v.spanPercent, 5, 100, fallback.spanPercent)),
    ...(v.bitmap !== undefined
      ? { bitmap: sanitizeDecorBitmap(v.bitmap) }
      : fallback.bitmap ? { bitmap: sanitizeDecorBitmap(fallback.bitmap) } : {}),
  };
}

/** Front plane moves slightly faster than the vehicle and occludes it. */
export function sanitizeForeground(value: unknown,
  fallback: ForegroundConfig = { ...DEFAULT_FOREGROUND }): ForegroundConfig {
  return sanitizeDecor(value, fallback, 1, 1.35);
}

/** Middle plane moves more slowly, between vehicles and mountainous/building backgrounds. */
export function sanitizeMidground(value: unknown,
  fallback: DecorLayerConfig = { ...DEFAULT_MIDGROUND }): DecorLayerConfig {
  return sanitizeDecor(value, fallback, 0.4, 1);
}

export function sanitizeLandscapeStyle(value: unknown, fallback = defaultLandscapePreferences().custom): LandscapeStyle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return copyLandscape(fallback);
  const v = value as Record<string, unknown>;
  const source = Array.isArray(v.layers) && v.layers.length >= 2 && v.layers.length <= 10
    ? v.layers : fallback.layers;
  const layers = source.map((item, i): LandscapeLayer => {
    const old = fallback.layers[i % fallback.layers.length]!;
    const layer = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return {
      type: layer.type === 'mountains' || layer.type === 'buildings' ? layer.type : old.type,
      color: color(layer.color, old.color),
      amplitude: int(layer.amplitude, 2, 35, old.amplitude),
      detail: int(layer.detail, 1, 100, old.detail),
    };
  });
  // Migrate existing v1 custom landscapes without discarding hand-edited layers.
  const legacy = !('automatic' in v);
  const autoFallback: AutomaticLandscape = fallback.automatic ?? AUTO_PRESETS.night;
  return {
    skyTop: color(v.skyTop, fallback.skyTop),
    skyBottom: color(v.skyBottom, fallback.skyBottom),
    stars: typeof v.stars === 'boolean' ? v.stars : fallback.stars,
    // Migrate older custom landscapes without a moon flag based on their stars preference.
    moon: typeof v.moon === 'boolean' ? v.moon : typeof v.stars === 'boolean' ? v.stars : fallback.moon,
    seed: int(v.seed, 0, 999999999, fallback.seed),
    layers,
    foreground: sanitizeForeground(v.foreground, fallback.foreground ?? { ...DEFAULT_FOREGROUND }),
    midground: sanitizeMidground(v.midground, fallback.midground ?? { ...DEFAULT_MIDGROUND }),
    automatic: sanitizeAutomatic(v.automatic, legacy
      ? {
          skyColor: color(v.skyTop, autoFallback.skyColor),
          frontColor: layers[layers.length - 1]!.color,
          layerCount: layers.length,
          composition: layers.every(l => l.type === 'mountains') ? 'mountains'
            : layers.every(l => l.type === 'buildings') ? 'buildings' : 'mixed',
        }
      : autoFallback),
    advancedEdited: typeof v.advancedEdited === 'boolean' ? v.advancedEdited : legacy,
  };
}

export function sanitizeLandscapePreferences(value: unknown): LandscapePreferences {
  const defaults = defaultLandscapePreferences();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const v = value as Record<string, unknown>;
  const rawLibrary = Array.isArray(v.library) ? v.library.slice(0, 100) : [];
  const seen = new Set<string>();
  const library: SavedLandscape[] = [];
  for (const item of rawLibrary) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === 'string' && isSavedLandscapeId(`user:${entry.id}`) ? entry.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    library.push({
      id,
      name: typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim().slice(0, 60) : 'Paisaje sin nombre',
      mode: entry.mode === 'advanced' ? 'advanced' : 'automatic',
      style: sanitizeLandscapeStyle(entry.style),
    });
  }
  const valid = new Set<string>([...PRESET_ORDER, ...library.map(item => `user:${item.id}`)]);
  const pool = Array.isArray(v.cyclePool) ? v.cyclePool.filter(
    (id): id is string => typeof id === 'string' && valid.has(id)) : [...PRESET_ORDER];
  const cyclePool = [...new Set(pool)];
  const selection = v.selection;
  const accepted = selection === 'cycle' || selection === 'custom'
    || (typeof selection === 'string' && valid.has(selection));
  return {
    selection: accepted ? selection as LandscapeSelection : defaults.selection,
    mode: v.mode === 'automatic' || v.mode === 'advanced' ? v.mode
      : v.selection === 'custom' ? 'advanced' : defaults.mode,
    custom: sanitizeLandscapeStyle(v.custom),
    library,
    cyclePool,
    rotation: v.rotation === 'shuffle' ? 'shuffle' : 'sequential',
  };
}

// Stable per-wave visual seed; never mutate the simulation's Random instance.
export function landscapeVisualSeed(gameSeed: number, styleSeed: number, wave: number, index: number): number {
  const random = new Random((gameSeed ^ styleSeed ^ Math.imul(wave, 0x9e3779b9) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0);
  return Math.floor(random.next() * 0xffffffff) >>> 0;
}
