import {
  BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry,
} from 'three/webgpu';
import { emission, metal } from '../materials';

/** Side-readable 2.5D rescue helicopter, built from reusable low-poly solids.
 * Coordinates face +X; the same sign-mirroring as the original ship applies.
 * Rotor assemblies are independent so reduced-motion can stop their animation.
 */
export function createHelicopter() {
  const group = new Group();
  group.name = 'vehicle-helicopter';

  const hull = metal(0x7a9491, 0.45, 0.65);
  const underside = metal(0x223b45, 0.65, 0.5);
  const accent = metal(0xe6bd5c, 0.4, 0.7);
  const glass = metal(0x163f50, 0.14, 0.85);
  glass.emissive.setHex(0x13506d);
  glass.emissiveIntensity = 0.45;
  const safety = emission(0x7bfbe5, 0.75);

  const fuselage = new Mesh(new SphereGeometry(2.65, 14, 9), hull);
  fuselage.scale.set(1.3, 0.7, 0.7);
  fuselage.position.set(0.25, 0.05, 0);
  fuselage.name = 'cabin';
  group.add(fuselage);

  const cockpit = new Mesh(new SphereGeometry(1.55, 12, 8), glass);
  cockpit.scale.set(0.82, 0.7, 0.69);
  cockpit.position.set(2.1, 0.52, 0.32);
  cockpit.name = 'cockpit';
  group.add(cockpit);

  const undersidePlate = new Mesh(new BoxGeometry(3.1, 0.25, 1.3), underside);
  undersidePlate.position.set(0, -1.25, 0);
  group.add(undersidePlate);

  const sideDoor = new Mesh(new BoxGeometry(1.05, 1.5, 0.09), underside);
  sideDoor.position.set(-0.2, 0.02, 1.15);
  group.add(sideDoor);
  const doorHandle = new Mesh(new BoxGeometry(0.55, 0.1, 0.12), safety);
  doorHandle.position.set(-0.45, 0.2, 1.23);
  group.add(doorHandle);

  // Tail boom, stabilizer and fin deliberately extend beyond the fuselage.
  const boom = new Mesh(new CylinderGeometry(0.25, 0.42, 4.65, 8), hull);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(-4.35, 0.48, -0.05);
  boom.name = 'tail-boom';
  group.add(boom);
  const fin = new Mesh(new BoxGeometry(0.28, 1.85, 0.44), accent);
  fin.position.set(-6.65, 0.98, 0);
  group.add(fin);
  const stabilizer = new Mesh(new BoxGeometry(1.7, 0.18, 1.5), underside);
  stabilizer.position.set(-6, 0.14, 0.15);
  group.add(stabilizer);

  // Skids are in the camera-facing plane, readable without perspective.
  for (const z of [-0.88, 0.88]) {
    const skid = new Mesh(new CylinderGeometry(0.09, 0.09, 5.5, 6), underside);
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -2.0, z);
    skid.name = 'landing-skid';
    group.add(skid);
    for (const x of [-1.5, 1.4]) {
      const strut = new Mesh(new CylinderGeometry(0.08, 0.08, 1.2, 6), hull);
      strut.position.set(x, -1.55, z);
      group.add(strut);
    }
  }

  const rotorMast = new Mesh(new CylinderGeometry(0.16, 0.16, 1.2, 8), underside);
  rotorMast.position.set(-0.35, 1.95, 0);
  group.add(rotorMast);

  const mainRotor = new Group();
  mainRotor.name = 'main-rotor';
  mainRotor.position.set(-0.35, 2.6, 0);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new Mesh(new BoxGeometry(10.2, 0.09, 0.27), underside);
    blade.rotation.y = angle;
    mainRotor.add(blade);
  }
  group.add(mainRotor);

  const tailRotor = new Group();
  tailRotor.name = 'tail-rotor';
  tailRotor.position.set(-6.65, 0.95, 0.5);
  const guard = new Mesh(new TorusGeometry(0.71, 0.06, 5, 20), hull);
  tailRotor.add(guard);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new Mesh(new BoxGeometry(1.25, 0.09, 0.08), accent);
    blade.rotation.z = angle;
    tailRotor.add(blade);
  }
  group.add(tailRotor);

  const noseStripe = new Mesh(new BoxGeometry(0.15, 0.48, 0.12), accent);
  noseStripe.position.set(3.4, -0.22, 0.23);
  group.add(noseStripe);

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
