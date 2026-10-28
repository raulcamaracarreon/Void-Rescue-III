import { describe, expect, it } from 'vitest';
import { Records, RECORDS_KEY } from '../../src/game/Records';
import type { PlayerRecord } from '../../src/game/Records';

const base: PlayerRecord = {
  id: 'old', pilot: 'VR1', score: 100, wave: 1, difficulty: 'normal',
  missionMode: 'rescue', spawnMode: 'classic', rescueProtocol: 'realistic',
  date: '2026-10-27T18:00:00.000Z',
};

function storage(initial: PlayerRecord[] = []) {
  const values = new Map([[RECORDS_KEY, JSON.stringify(initial)]]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('fase 4 — récords por vehículo sin perder históricos', () => {
  it('interpreta las marcas antiguas sin vehículo como récords de nave', () => {
    const records = new Records(storage([base]));
    expect(records.list('classic', 'rescue', 'realistic', 'ship').map(r => r.id)).toEqual(['old']);
    expect(records.list('classic', 'rescue', 'realistic', 'helicopter')).toEqual([]);
  });

  it('no mezcla el top 10 de helicóptero con el de la nave original', () => {
    const records = new Records(storage([base]));
    records.save({ ...base, id: 'heli', pilot: 'H01', score: 900, vehicleId: 'helicopter' });
    const ship = records.list('classic', 'rescue', 'realistic', 'ship');
    const heli = records.list('classic', 'rescue', 'realistic', 'helicopter');
    expect(ship.map(r => r.id)).toEqual(['old']);
    expect(heli.map(r => r.id)).toEqual(['heli']);
    expect(records.list()).toHaveLength(2);
  });

  it('mantiene diez lugares independientes para cada vehículo y su clasificación', () => {
    const records = new Records(storage());
    for (const vehicleId of ['ship', 'helicopter'] as const) {
      for (let i = 0; i < 13; i++)
        records.save({ ...base, id: `${vehicleId}-${i}`, score: i + 1, vehicleId });
    }
    expect(records.list('classic', 'rescue', 'realistic', 'ship')).toHaveLength(10);
    expect(records.list('classic', 'rescue', 'realistic', 'helicopter')).toHaveLength(10);
  });

  it('rechaza identificadores de vehículo corruptos sin perder las marcas válidas', () => {
    const records = new Records(storage([base, { ...base, id: 'wrong', vehicleId: 'flying-car' as never }]));
    expect(records.list().map(r => r.id)).toEqual(['old']);
  });
});
