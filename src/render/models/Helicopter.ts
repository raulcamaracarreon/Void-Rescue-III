import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, SphereGeometry,
} from 'three/webgpu';
import type { Material } from 'three/webgpu';
import { emission, metal } from '../materials';

/** Sized for gameplay parity with the classic ship (the original oversized
 * showcase value was 1.18). Do not modify rotor geometry or animation to
 * compensate: a single uniform scale preserves the accepted silhouette.
 */
export const HELICOPTER_GAME_SCALE = 0.56;

/** Faceted side silhouette instead of spheres: readable in the 2.5D camera
 * at ordinary gameplay size and evocative of a twin-engine utility helicopter.
 * The craft faces +X; +Z is the camera-facing door/window side.
 */
function panel(points: [number, number][], depth: number, material: Material): Mesh {
  const path = new Shape();
  path.moveTo(...points[0]!);
  for (const point of points.slice(1)) path.lineTo(...point);
  path.closePath();
  const bevel = depth > 0.3;
  const geometry = new ExtrudeGeometry(path, {
    depth, steps: 1, bevelEnabled: bevel,
    ...(bevel ? { bevelSegments: 1, bevelSize: 0.09, bevelThickness: 0.08 } : {}),
  });
  geometry.translate(0, 0, -depth / 2);
  return new Mesh(geometry, material);
}

/** Black-Hawk-style utility rescue silhouette; original geometry, no imported
 * military asset or markings. Camera-facing details are deliberately oversized
 * enough to read during a normal 1920×1080 flight.
 */
export function createHelicopter() {
  const group = new Group();
  group.name = 'vehicle-helicopter';

  const olive = metal(0x53665e, 0.83, 0.24);
  const armor = metal(0x384b45, 0.85, 0.25);
  const belly = metal(0x263631, 0.87, 0.3);
  const panelDark = metal(0x1c292b, 0.75, 0.2);
  const window = metal(0x1c5666, 0.21, 0.45);
  window.emissive.setHex(0x174352);
  window.emissiveIntensity = 0.18;
  const safety = emission(0xdec57b, 0.8);
  const hub = metal(0xa1a8a0, 0.64, 0.45);

  // Taller, angular cabin and downward-sloping cockpit windshield.
  const cabin = panel([
    [-5.4, -1.2], [-5.05, 1.6], [-4.0, 1.95], [3.6, 1.95],
    [5.3, 1.2], [6.45, -0.3], [5.55, -1.45], [3.7, -1.8], [-4.4, -1.8],
  ], 2.4, olive);
  cabin.name = 'cabin';
  group.add(cabin);

  const bellyPlate = panel([
    [-4.65, -1.56], [4.9, -1.56], [4.0, -2.02], [-3.5, -2.02],
  ], 2.08, belly);
  group.add(bellyPlate);

  // A separate wide side door with a strong dark outline and rescue sill.
  const door = panel([
    [-3.95, -1.15], [-3.95, 1.35], [0.12, 1.35], [0.12, -1.15],
  ], 0.08, armor);
  door.name = 'sliding-door';
  door.position.z = 1.30;
  group.add(door);

  const doorWindow = panel([
    [-3.56, 0.38], [-3.45, 1.12], [-0.38, 1.12], [-0.38, 0.38],
  ], 0.06, window);
  doorWindow.position.z = 1.39;
  group.add(doorWindow);

  const doorFrame = new Mesh(new BoxGeometry(0.13, 2.45, 0.12), panelDark);
  doorFrame.position.set(-0.35, 0.12, 1.41);
  group.add(doorFrame);
  const handle = new Mesh(new BoxGeometry(0.55, 0.10, 0.14), safety);
  handle.position.set(-0.75, -0.45, 1.44);
  group.add(handle);
  const sideStep = new Mesh(new BoxGeometry(3.0, 0.13, 0.35), panelDark);
  sideStep.position.set(-2.0, -1.55, 1.36);
  group.add(sideStep);

  const cockpit = panel([
    [0.55, -0.78], [0.55, 1.56], [3.65, 1.56],
    [5.08, 0.90], [5.85, -0.16], [5.0, -0.81],
  ], 0.08, panelDark);
  cockpit.name = 'cockpit';
  cockpit.position.z = 1.27;
  group.add(cockpit);

  const rearWindshield = panel([
    [0.80, 0.28], [0.80, 1.29], [2.77, 1.29], [2.61, 0.28],
  ], 0.07, window);
  rearWindshield.position.z = 1.38;
  group.add(rearWindshield);
  const frontWindshield = panel([
    [2.92, 0.27], [3.07, 1.29], [3.63, 1.29],
    [4.84, 0.68], [5.37, 0.0], [5.02, -0.36],
  ], 0.07, window);
  frontWindshield.position.z = 1.38;
  group.add(frontWindshield);
  const frontPost = new Mesh(new BoxGeometry(0.13, 1.16, 0.12), olive);
  frontPost.position.set(2.81, 0.8, 1.42);
  group.add(frontPost);

  // Twin turbine engine housings above the squared cabin.
  for (const z of [-0.72, 0.72]) {
    const engine = new Mesh(new CylinderGeometry(0.46, 0.49, 3.6, 8), armor);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-1.48, 2.12, z);
    engine.name = 'turbine-engine';
    group.add(engine);
    const exhaust = new Mesh(new CylinderGeometry(0.33, 0.33, 0.17, 8), panelDark);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-3.4, 2.12, z);
    group.add(exhaust);
  }

  // Slim angular boom connects to a higher tail fin and four-blade tail rotor.
  const boom = panel([
    [-4.85, 0.70], [-10.95, 1.45], [-11.25, 1.10],
    [-10.7, 0.74], [-5.1, -0.38],
  ], 0.6, armor);
  boom.name = 'tail-boom';
  group.add(boom);
  const fin = panel([
    [-11.16, 0.56], [-11.65, 3.24], [-10.92, 3.42], [-10.65, 1.18],
  ], 0.38, olive);
  fin.name = 'tail-fin';
  group.add(fin);
  const stabilizer = new Mesh(new BoxGeometry(2.9, 0.17, 1.6), belly);
  stabilizer.position.set(-10.45, 0.75, 0);
  group.add(stabilizer);

  // UH-60-like wheeled landing gear instead of toy helicopter skids.
  for (const x of [-3.65, 3.65]) {
    const strut = new Mesh(new CylinderGeometry(0.14, 0.16, 1.35, 7), armor);
    strut.position.set(x, -1.98, 0.88);
    strut.rotation.z = x > 0 ? 0.3 : -0.3;
    group.add(strut);
    const tire = new Mesh(new CylinderGeometry(0.57, 0.57, 0.40, 12), panelDark);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(x, -2.48, 0.98);
    tire.name = 'landing-wheel';
    group.add(tire);
    const rim = new Mesh(new CylinderGeometry(0.20, 0.20, 0.44, 10), hub);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, -2.48, 1.0);
    group.add(rim);
  }

  const rotorMast = new Mesh(new CylinderGeometry(0.19, 0.22, 1.42, 10), belly);
  rotorMast.position.set(-0.55, 3.10, 0);
  group.add(rotorMast);
  const mainRotor = new Group();
  mainRotor.name = 'main-rotor';
  mainRotor.position.set(-0.55, 3.81, 0);
  // Two long crossing blades => four blade tips like a utility helicopter.
  for (const angle of [0, Math.PI / 2]) {
    const blade = new Mesh(new BoxGeometry(16.5, 0.12, 0.40), panelDark);
    blade.rotation.y = angle;
    mainRotor.add(blade);
  }
  const mainHub = new Mesh(new SphereGeometry(0.29, 10, 6), hub);
  mainRotor.add(mainHub);
  group.add(mainRotor);

  const tailRotor = new Group();
  tailRotor.name = 'tail-rotor';
  tailRotor.position.set(-11.58, 2.15, 0.57);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new Mesh(new BoxGeometry(2.45, 0.12, 0.14), panelDark);
    blade.rotation.z = angle;
    tailRotor.add(blade);
  }
  const tailHub = new Mesh(new SphereGeometry(0.16, 8, 6), hub);
  tailRotor.add(tailHub);
  group.add(tailRotor);

  // Small SAR identifier, not an imported insignia or real unit markings.
  const rescueStripe = new Mesh(new BoxGeometry(1.15, 0.13, 0.11), safety);
  rescueStripe.position.set(-2.2, -0.94, 1.46);
  group.add(rescueStripe);
  const rescueVertical = new Mesh(new BoxGeometry(0.13, 0.67, 0.11), safety);
  rescueVertical.position.set(-2.2, -0.94, 1.47);
  group.add(rescueVertical);

  return { group, mainRotor, tailRotor };
}

export type HelicopterModel = ReturnType<typeof createHelicopter>;

/** Visual-only animation. Pausing/reduced-motion never changes simulation. */
export function animateHelicopter(model: HelicopterModel, elapsed: number,
  reducedMotion: boolean): void {
  if (reducedMotion || !Number.isFinite(elapsed) || elapsed <= 0) return;
  const dt = Math.min(elapsed, 0.1);
  model.mainRotor.rotation.y = (model.mainRotor.rotation.y + dt * 26) % (2 * Math.PI);
  model.tailRotor.rotation.z = (model.tailRotor.rotation.z + dt * 37) % (2 * Math.PI);
}
