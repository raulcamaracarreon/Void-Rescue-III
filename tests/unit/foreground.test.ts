import { describe, expect, it } from 'vitest';
import { Mesh } from 'three/webgpu';
import {
  copyLandscape, DEFAULT_FOREGROUND, DEFAULT_MIDGROUND, defaultLandscapePreferences, resolveLandscape,
  sanitizeForeground, sanitizeMidground, sanitizeLandscapePreferences,
} from '../../src/landscape/LandscapeConfig';
import { ForegroundDecor, FOREGROUND_DEPTH, MIDGROUND_DEPTH } from '../../src/render/ForegroundDecor';
import { CONFIG } from '../../src/game/config';

describe('primer plano decorativo opcional', () => {
  it('parte desactivado y no altera la selección ni el orden de los ambientes', () => {
    const preferences = defaultLandscapePreferences();
    expect(preferences.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    const pool = [...preferences.cyclePool];
    preferences.selection = 'custom';
    preferences.custom.foreground = {
      enabled: true, kind: 'fence', color: '#335544', opacity: 0.55, parallax: 1.2,
    };
    const restored = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(preferences)));
    expect(restored.cyclePool).toEqual(pool);
    expect(restored.custom.foreground).toEqual(preferences.custom.foreground);
    expect(resolveLandscape(restored, 1).style.foreground).toEqual(preferences.custom.foreground);
  });

  it('sanea datos inválidos y conserva compatibilidad con paisajes anteriores', () => {
    expect(sanitizeForeground({ enabled: 'yes', kind: '<img>', color: 'xxx',
      opacity: Infinity, parallax: -4 })).toEqual({ ...DEFAULT_FOREGROUND, parallax: 1 });
    expect(sanitizeForeground({ enabled: true, kind: 'grille', color: '#abcdef',
      opacity: 12, parallax: 2 })).toEqual({
      enabled: true, kind: 'grille', color: '#abcdef', opacity: 0.85, parallax: 1.35,
    });
    const older = defaultLandscapePreferences();
    delete older.custom.foreground;
    const restored = sanitizeLandscapePreferences(older);
    expect(restored.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    expect(restored.custom.foreground?.enabled).toBe(false);
  });

  it('independiza la configuración del primer plano al duplicar estilos', () => {
    const initial = defaultLandscapePreferences().custom;
    const copied = copyLandscape(initial);
    copied.foreground!.enabled = true;
    expect(initial.foreground!.enabled).toBe(false);
  });

  it('no crea geometría si está desactivado y libera mallas al desactivarlo', () => {
    const layer = new ForegroundDecor();
    layer.rebuild({ ...DEFAULT_FOREGROUND }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(0);
    layer.rebuild({ ...DEFAULT_FOREGROUND, enabled: true }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(3);
    layer.rebuild({ ...DEFAULT_FOREGROUND }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(0);
    layer.dispose();
  });


  it('crea dos configuraciones independientes y migra paisajes antiguos con primer plano', () => {
    const preferences = defaultLandscapePreferences();
    preferences.selection = 'custom';
    expect(preferences.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    expect(preferences.custom.midground).toEqual(DEFAULT_MIDGROUND);
    const oldLandscape = copyLandscape(preferences.custom);
    oldLandscape.foreground = { ...DEFAULT_FOREGROUND, enabled: true, kind: 'fence', opacity: 0.7 };
    delete oldLandscape.midground;
    preferences.library.push({ id: 'old-world', name: 'Antiguo', mode: 'automatic', style: oldLandscape });
    const restored = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(preferences)));
    expect(restored.library[0]!.style.foreground).toEqual(oldLandscape.foreground);
    expect(restored.library[0]!.style.midground).toEqual(DEFAULT_MIDGROUND);
    restored.library[0]!.style.midground!.enabled = true;
    expect(restored.library[0]!.style.foreground?.enabled).toBe(true);
    expect(oldLandscape.midground).toBeUndefined();
  });

  it('sanea el paralaje de cada plano dentro de su propio rango', () => {
    expect(sanitizeMidground({ enabled: true, kind: 'trees', color: '#998877',
      opacity: 0.45, parallax: 0.6 }).parallax).toBe(0.6);
    expect(sanitizeMidground({ parallax: -10 }).parallax).toBe(0.4);
    expect(sanitizeMidground({ parallax: 1.8 }).parallax).toBe(1);
    expect(sanitizeForeground({ parallax: 0.5 }).parallax).toBe(1);
    expect(sanitizeForeground({ parallax: 2 }).parallax).toBe(1.35);
  });

  it('duplica independientemente tanto tercer plano como primer plano', () => {
    const initial = defaultLandscapePreferences().custom;
    const duplicated = copyLandscape(initial);
    duplicated.foreground!.enabled = true;
    duplicated.midground!.enabled = true;
    duplicated.midground!.kind = 'grille';
    expect(initial.foreground!.enabled).toBe(false);
    expect(initial.midground!.enabled).toBe(false);
    expect(initial.midground!.kind).toBe('trees');
  });

  it('ubica el tercer plano detrás de los vehículos pero delante de los paisajes', () => {
    expect(MIDGROUND_DEPTH).toBeLessThan(0);
    expect(MIDGROUND_DEPTH).toBeGreaterThan(-31); // Nearest mountain/building silhouette
    expect(FOREGROUND_DEPTH).toBeGreaterThan(0);
    const mid = new ForegroundDecor(MIDGROUND_DEPTH, 0x7258c39d);
    const front = new ForegroundDecor(FOREGROUND_DEPTH);
    mid.rebuild({ ...DEFAULT_MIDGROUND, enabled: true }, 8042, 3, 2);
    front.rebuild({ ...DEFAULT_FOREGROUND, enabled: true }, 8042, 3, 2);
    const midMesh = mid.group.children[1] as Mesh;
    const frontMesh = front.group.children[1] as Mesh;
    const midPositions = midMesh.geometry.getAttribute('position');
    const frontPositions = frontMesh.geometry.getAttribute('position');
    expect(midPositions.getZ(0)).toBe(MIDGROUND_DEPTH);
    expect(frontPositions.getZ(0)).toBe(FOREGROUND_DEPTH);
    expect(midMesh.renderOrder).toBeLessThan(frontMesh.renderOrder);
    expect([...midPositions.array]).not.toEqual([...frontPositions.array]);
    mid.update(200);
    front.update(200);
    expect(midMesh.position.x).not.toBe(frontMesh.position.x);
    mid.dispose();
    front.dispose();
  });

  it('genera motivos repetibles sin dependencias del sistema de colisiones', () => {
    for (const kind of ['trees', 'fence', 'grille'] as const) {
      const a = new ForegroundDecor(), b = new ForegroundDecor();
      const config = { ...DEFAULT_FOREGROUND, enabled: true, kind };
      a.rebuild(config, 8042, 6, 3);
      b.rebuild(config, 8042, 6, 3);
      const meshA = a.group.children[0] as Mesh;
      const meshB = b.group.children[0] as Mesh;
      expect(meshA.geometry.getAttribute('position').array)
        .toEqual(meshB.geometry.getAttribute('position').array);
      expect(meshA.geometry.getAttribute('position').count).toBeGreaterThan(0);
      a.update(CONFIG.worldWidth - 1);
      const before = (a.group.children[1] as Mesh).position.x;
      a.update(CONFIG.worldWidth + 1);
      const after = (a.group.children[1] as Mesh).position.x;
      expect(Number.isFinite(before + after)).toBe(true);
      a.update(300, true);
      expect((a.group.children[1] as Mesh).position.x).toBe(0);
      a.dispose(); b.dispose();
    }
  });
});
