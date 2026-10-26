import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute,
  Group, InstancedMesh, Mesh, Object3D, PlaneGeometry, SphereGeometry, TorusGeometry,
} from 'three/webgpu';
import { Random } from '../core/Random';
import { CONFIG, SAFE_BASE, SETTLEMENTS } from '../game/config';
import type { MissionMode } from '../game/MissionMode';
import { Terrain } from '../game/Terrain';
import { DEFAULT_FOREGROUND, defaultLandscapePreferences, resolveLandscape } from '../landscape/LandscapeConfig';
import type { LandscapePreferences } from '../landscape/LandscapeConfig';
import { ParallaxLandscape } from './ParallaxLandscape';
import { ForegroundDecor } from './ForegroundDecor';
import { nearCameraX } from '../core/WorldWrap';
import { basaltMaterial, beaconMaterial, emission, metal, skyMaterial } from './materials';

function makeRidge(seed: number, depth: number, distant: boolean): Mesh {
  const terrain = new Terrain(seed);
  const vertices: number[] = [], indices: number[] = [];
  const step = distant ? 8 : 2;
  for (let x = 0; x <= CONFIG.worldWidth; x += step) {
    const height = distant ? terrain.height(x) * 2.9 - 8 : terrain.height(x);
    // A slanted upper ledge and faceted front face give the basalt depth.
    vertices.push(x, height, depth - 8, x, height - (distant ? 0 : 2.5), depth, x, -28, depth + 3);
    if (x > 0) {
      const i = (x / step - 1) * 3;
      indices.push(i, i + 1, i + 3, i + 1, i + 4, i + 3, i + 1, i + 2, i + 4, i + 2, i + 5, i + 4);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // End vertices have only one neighbor until the tile repeats. Share their
  // averaged normals so lighting is continuous as well as position and slope.
  const normals = geometry.getAttribute('normal');
  for (let first = 0; first < 3; first++) {
    const last = normals.count - 3 + first;
    const x = normals.getX(first) + normals.getX(last);
    const y = normals.getY(first) + normals.getY(last);
    const z = normals.getZ(first) + normals.getZ(last);
    const length = Math.hypot(x, y, z) || 1;
    normals.setXYZ(first, x / length, y / length, z / length);
    normals.setXYZ(last, x / length, y / length, z / length);
  }
  const material = distant ? metal(0x152c36, 0.98, 0.12) : basaltMaterial();
  if (distant) { material.emissive.setHex(0x10202a); material.emissiveIntensity = 0.3; }
  return new Mesh(geometry, material);
}

function createSettlement(x: number, terrain: Terrain, random: Random): Group {
  const group = new Group();
  group.position.set(x, terrain.height(x) - 0.4, -8);
  const steel = metal(0x7d9290, 0.72, 0.5), dark = metal(0x23343a, 0.82, 0.4);
  const amber = emission(0xe4b977, 0.75), cyan = beaconMaterial();
  const deck = new Mesh(new BoxGeometry(23, 1, 8), dark);
  deck.position.y = 0.5;
  group.add(deck);
  for (let i = 0; i < 5; i++) {
    const width = random.range(2, 3.6), height = random.range(1.6, 4.5);
    const building = new Mesh(new BoxGeometry(width, height, 3.5), steel);
    building.position.set(i * 4.1 - 8.2, height / 2 + 1, 0);
    group.add(building);
    const roof = new Mesh(new BoxGeometry(width + 0.3, 0.22, 3.7), dark);
    roof.position.copy(building.position); roof.position.y += height / 2;
    group.add(roof);
    const window = new Mesh(new BoxGeometry(width * 0.6, 0.24, 0.08), amber);
    window.position.set(building.position.x, height * 0.65 + 1, 1.8);
    group.add(window);
  }
  const mast = new Mesh(new CylinderGeometry(0.1, 0.16, 10, 5), steel);
  mast.position.set(6, 7.2, -1);
  group.add(mast);
  const bar = new Mesh(new BoxGeometry(3.5, 0.15, 0.18), steel);
  bar.position.set(6, 10.5, -1); group.add(bar);
  const beacon = new Mesh(new SphereGeometry(0.3, 8, 6), cyan);
  beacon.position.set(6, 12.3, -1); group.add(beacon);
  for (const offset of [-11, 11]) {
    const light = new Mesh(new BoxGeometry(0.4, 0.3, 0.4), cyan);
    light.position.set(offset, 1.2, 3.6); group.add(light);
  }
  return group;
}

function createRescueFortress(terrain: Terrain): Group {
  const group = new Group();
  group.position.set(SAFE_BASE.x, terrain.height(SAFE_BASE.x), -4.5);
  const armor = metal(0x38515a, 0.58, 0.72), dark = metal(0x172b34, 0.86, 0.45), safe = emission(0x72ffd6, 1.1);
  const pad = new Mesh(new CylinderGeometry(8.5, 9.5, 0.7, 16), dark); pad.position.y = 0.4; group.add(pad);
  const padRing = new Mesh(new TorusGeometry(6.3, 0.24, 8, 32), safe); padRing.rotation.x = Math.PI / 2; padRing.position.y = 0.82; group.add(padRing);
  for (const side of [-1, 1]) {
    const wall = new Mesh(new BoxGeometry(8, 3.2, 4.5), armor); wall.position.set(side * 11.5, 1.8, 0); group.add(wall);
    const tower = new Mesh(new CylinderGeometry(2.1, 2.7, 11, 8), armor); tower.position.set(side * 16, 5.5, 0); group.add(tower);
    const crown = new Mesh(new TorusGeometry(2.25, 0.22, 6, 16), safe); crown.rotation.x = Math.PI / 2; crown.position.set(side * 16, 11, 0); group.add(crown);
  }
  const arch = new Mesh(new BoxGeometry(9, 0.8, 2.2), armor); arch.position.set(0, 8.5, 0); group.add(arch);
  for (const side of [-1, 1]) {
    const pillar = new Mesh(new BoxGeometry(1.1, 8, 2.2), armor); pillar.position.set(side * 4, 4.5, 0); group.add(pillar);
  }
  const beacon = new Mesh(new SphereGeometry(0.65, 12, 8), safe); beacon.position.set(0, 10.2, 0); group.add(beacon);
  return group;
}

export class WorldScene {
  readonly group = new Group();
  readonly backdrop = new Group();
  private readonly terrainCopies: Group[] = [];
  private readonly landscape = new ParallaxLandscape();
  readonly foreground = new ForegroundDecor();
  private lastLandscapeKey = '';
  private readonly settlements: Group[] = [];
  private readonly stars: InstancedMesh;
  private readonly starPositions: { x: number; y: number; z: number; size: number }[] = [];
  private readonly matrix = new Object3D();
  private readonly sky: Mesh;
  private readonly moon = new Group();
  private readonly fortress: Group;

  constructor(private readonly seed: number, preferences: LandscapePreferences = defaultLandscapePreferences()) {
    const random = new Random(seed ^ 0x71a4);
    const terrain = new Terrain(seed);
    this.fortress = createRescueFortress(terrain);
    this.group.add(this.fortress);
    this.sky = new Mesh(new PlaneGeometry(1, 1), skyMaterial());
    this.sky.position.set(0, 52, -170);
    this.backdrop.add(this.sky, this.landscape.group);

    // White, compact moon instead of the oversized textured planet.
    const lunarDisc = new Mesh(new SphereGeometry(5.2, 40, 24), emission(0xf8fbff));
    this.moon.add(lunarDisc);
    const halo = new Mesh(new SphereGeometry(7.2, 40, 24), emission(0xdfeeff));
    halo.material.transparent = true;
    halo.material.opacity = 0.1;
    halo.material.depthWrite = false;
    halo.position.z = -1;
    this.moon.add(halo);
    // World Y=74 places the moon well below the top panoramic radar.
    this.moon.position.set(42, 74, -125);
    this.backdrop.add(this.moon);

    this.stars = new InstancedMesh(new PlaneGeometry(1, 1), emission(0xb8cfdb), 620);
    for (let i = 0; i < this.stars.count; i++) {
      this.starPositions.push({ x: random.range(-165, 165), y: random.range(18, 140), z: random.range(-150, -130), size: random.range(0.05, 0.23) });
      this.stars.setColorAt(i, new Color().setRGB(random.range(0.3, 0.9), random.range(0.5, 1), random.range(0.65, 1)));
    }
    this.stars.frustumCulled = false;
    this.backdrop.add(this.stars);

    const mainRidge = makeRidge(seed, 8, false);
    // The actual collider/ground stays identical; parallax replaces only distant ridges.
    for (let copy = -1; copy <= 1; copy++) {
      const tile = new Group();
      tile.add(mainRidge.clone());
      this.terrainCopies.push(tile);
      this.group.add(tile);
    }

    for (const settlement of SETTLEMENTS) {
      const model = createSettlement(settlement.x, terrain, random);
      model.userData.worldX = settlement.x;
      this.settlements.push(model);
      this.group.add(model);
    }
    this.group.add(this.foreground.group);
    this.setLandscape(preferences, 1);
  }

  setLandscape(preferences: LandscapePreferences, wave: number): void {
    const { style } = resolveLandscape(preferences, wave, this.seed);
    const key = JSON.stringify({ style, wave });
    if (key === this.lastLandscapeKey) return;
    this.lastLandscapeKey = key;
    const previous = this.sky.material;
    this.sky.material = skyMaterial(style.skyTop, style.skyBottom);
    if (Array.isArray(previous)) previous.forEach(material => material.dispose());
    else previous.dispose();
    this.stars.visible = style.stars;
    this.moon.visible = style.moon;
    this.landscape.rebuild(style, this.seed, wave);
    this.foreground.rebuild(style.foreground ?? { ...DEFAULT_FOREGROUND }, this.seed, style.seed, wave);
  }

  update(cameraX: number, viewWidth: number, missionMode: MissionMode, reducedMotion = false): void {
    this.backdrop.position.x = cameraX;
    this.landscape.update(cameraX, reducedMotion);
    this.foreground.update(cameraX, reducedMotion);
    this.sky.scale.set(viewWidth + 5, 140, 1);
    this.moon.position.x = viewWidth * 0.24 - (reducedMotion ? 0 : Math.sin(cameraX / CONFIG.worldWidth * Math.PI * 2) * 4);
    const tileIndex = Math.floor(cameraX / CONFIG.worldWidth);
    this.terrainCopies.forEach((tile, index) => { tile.position.x = (tileIndex + index - 1) * CONFIG.worldWidth; });
    this.settlements.forEach(model => { model.position.x = nearCameraX(model.userData.worldX as number, cameraX, CONFIG.worldWidth); });
    this.fortress.visible = missionMode === 'rescue';
    this.fortress.position.x = nearCameraX(SAFE_BASE.x, cameraX, CONFIG.worldWidth);
    this.starPositions.forEach((star, i) => {
      this.matrix.position.set(((star.x - (reducedMotion ? 0 : cameraX * 0.035) + 165) % 330 + 330) % 330 - 165, star.y, star.z);
      this.matrix.scale.setScalar(star.size);
      this.matrix.updateMatrix();
      this.stars.setMatrixAt(i, this.matrix.matrix);
    });
    this.stars.instanceMatrix.needsUpdate = true;
  }
}
