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
    /** Clearance from the player's center to the terrain in ground-hugging flight. */
    readonly groundClearance: number;
  };
  readonly weapon: {
    readonly projectileSpeed: number;
    readonly muzzleOffset: number;
  };
  /** Explicit passenger/boarding rules. null means the classic ship remains unlimited. */
  readonly rescue: {
    readonly capacity: number | null;
    readonly pickupRange: number;
    readonly minPickupHeight: number;
    readonly maxPickupHeight: number;
    readonly maxPickupSpeed: number | null;
    readonly extractionSpeed: number;
    readonly extractionHorizontalSpeed: number;
    readonly deliverySpeed: number;
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
    groundClearance: 0, // legacy flight keeps its historical altitude floor
  },
  weapon: { projectileSpeed: CONFIG.shotSpeed, muzzleOffset: 5 },
  rescue: { capacity: null, pickupRange: 8, minPickupHeight: 3, maxPickupHeight: 17,
    maxPickupSpeed: null, extractionSpeed: 5.5, extractionHorizontalSpeed: 11, deliverySpeed: 22 },
};

/** More responsive arcade utility helicopter. At 175/1.7 horizontal thrust
 * reaches a 90-unit/s limit; it can descend to landing-gear clearance above
 * the terrain in both diagnostic and combat scenarios. Experimental only:
 * rescue capacity, weapons, audio and ranked gameplay are not integrated.
 */
export const HELICOPTER_PROFILE: VehicleProfile = {
  id: 'helicopter',
  name: 'Helicóptero de rescate (experimental)',
  flight: {
    acceleration: 175,
    drag: 1.7,
    maxSpeed: 90,
    verticalSpeed: 42,
    verticalResponse: 9,
    groundClearance: 2.0, // matches the smaller landing wheels (0.56 visual scale)
  },
  weapon: { projectileSpeed: 150, muzzleOffset: 5 },
  rescue: { capacity: 2, pickupRange: 7, minPickupHeight: 0.5, maxPickupHeight: 11,
    maxPickupSpeed: 20, extractionSpeed: 9, extractionHorizontalSpeed: 13, deliverySpeed: 15 },
};

export const VEHICLE_PROFILES: Readonly<Record<VehicleId, VehicleProfile>> = {
  ship: SHIP_PROFILE,
  helicopter: HELICOPTER_PROFILE,
};

export function vehicleProfile(id: VehicleId = 'ship'): VehicleProfile {
  return VEHICLE_PROFILES[id] ?? SHIP_PROFILE;
}
