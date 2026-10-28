import { CONFIG } from './config';

/** Phase 4: deterministic parameters independent of renderers and input devices.
 * Vehicle appearance, sounds and rescue animations belong to later increments.
 * Profiles do not duplicate combat, scoring, wave or rescue implementations.
 */
export type VehicleId = 'ship' | 'helicopter';

export interface VehicleProfile {
  readonly id: VehicleId;
  readonly name: string;
  readonly flight: {
    readonly acceleration: number;
    readonly drag: number;
    readonly maxSpeed: number;
    readonly verticalSpeed: number;
    readonly verticalResponse: number;
  };
  readonly weapon: {
    readonly projectileSpeed: number;
    readonly muzzleOffset: number;
  };
}

/** The legacy ship must reproduce VR2/VR3 movement and projectile speeds
 * byte-for-byte at the current fixed step. Do not retune these constants.
 */
export const SHIP_PROFILE: VehicleProfile = {
  id: 'ship',
  name: 'Nave de rescate',
  flight: {
    acceleration: CONFIG.acceleration,
    drag: CONFIG.drag,
    maxSpeed: CONFIG.maxSpeed,
    verticalSpeed: CONFIG.verticalSpeed,
    verticalResponse: CONFIG.verticalResponse,
  },
  weapon: { projectileSpeed: CONFIG.shotSpeed, muzzleOffset: 5 },
};

/** Flight dynamics candidate for the first alternate vehicle.
 * Experimental / simulation-only: do not offer in UI until its 3D model,
 * input, camera framing, rescue and weapon behavior are integrated and tested.
 */
export const HELICOPTER_PROFILE: VehicleProfile = {
  id: 'helicopter',
  name: 'Helicóptero de rescate (experimental)',
  flight: {
    acceleration: 64,
    drag: 2.4,
    maxSpeed: 48,
    verticalSpeed: 28,
    verticalResponse: 5.5,
  },
  weapon: { projectileSpeed: 150, muzzleOffset: 5 },
};

export const VEHICLE_PROFILES: Readonly<Record<VehicleId, VehicleProfile>> = {
  ship: SHIP_PROFILE,
  helicopter: HELICOPTER_PROFILE,
};

export function vehicleProfile(id: VehicleId = 'ship'): VehicleProfile {
  return VEHICLE_PROFILES[id] ?? SHIP_PROFILE;
}
