import {
  ACESFilmicToneMapping, BoxGeometry, DirectionalLight, HemisphereLight,
  Mesh, OrthographicCamera, Scene, SRGBColorSpace, WebGPURenderer,
} from 'three/webgpu';
import type { Object3D, BufferGeometry, Material } from 'three/webgpu';
import { nearCameraX, wrappedLerp } from '../core/WorldWrap';
import { CONFIG } from '../game/config';
import type { VehicleId } from '../game/VehicleProfile';
import type { FlightState } from '../game/Simulation';
import { CameraRig } from './CameraRig';
import { createShip } from './models/Ship';
import { animateHelicopter, createHelicopter } from './models/Helicopter';
import type { HelicopterModel } from './models/Helicopter';
import { emission } from './materials';
import { WorldScene } from './WorldScene';
import { defaultLandscapePreferences, resolveLandscape } from '../landscape/LandscapeConfig';
import { adaptivePalette } from '../landscape/AdaptivePalette';
import type { LandscapePreferences } from '../landscape/LandscapeConfig';
import { CombatVisuals } from './CombatVisuals';

export function disposeTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  root.traverse(object => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

export interface RenderMetrics {
  backend: 'webgpu' | 'webgl2'; fps: number; frameMs: number;
  drawCalls: number; triangles: number; geometries: number; textures: number;
  width: number; height: number; pixelRatio: number; cameraX: number; viewWidth: number;
  vehicleId: VehicleId;
  /** Actual visible scene model, to diagnose 3D/profile mismatches. */
  renderedModel: VehicleId;
}

export class FlightRenderer {
  readonly renderer: WebGPURenderer;
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-100, 100, 56, -56, 0.1, 400);
  readonly rig: CameraRig;
  backend: 'webgpu' | 'webgl2' = 'webgl2';
  private world: WorldScene;
  private seed: number;
  private landscapePreferences: LandscapePreferences;
  private readonly ship = createShip();
  private helicopter: HelicopterModel | null = null;
  private currentVehicle: VehicleId = 'ship';
  readonly combat = new CombatVisuals();
  private readonly shots = new Map<number, Mesh>();
  private readonly shotGeometry = new BoxGeometry(3.4, 0.3, 0.15);
  private readonly shotOutlineGeometry = new BoxGeometry(3.9, 0.68, 0.12);
  private readonly shotMaterial = emission(0x39ff14);
  private readonly shotOutlineMaterial = emission(0x060d17);
  private readonly hostileShotMaterial = emission(0xff816d);
  private facingAngle = 0;
  private frameTimes: number[] = [];
  private width = 1;
  private height = 1;
  private readonly observer: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, seed: number, forceWebGL: boolean,
    landscapePreferences: LandscapePreferences = defaultLandscapePreferences()) {
    this.seed = seed;
    this.landscapePreferences = landscapePreferences;
    this.rig = new CameraRig(CONFIG.startX);
    this.renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.info.autoReset = false;
    this.camera.position.set(0, 52, 120);
    this.world = new WorldScene(seed, landscapePreferences);
    this.updatePlayerLaser(1);
    this.scene.add(this.world.group, this.world.backdrop, this.ship.group, this.combat.group);
    const hemisphere = new HemisphereLight(0x8fc8df, 0x1c292f, 2.0);
    const key = new DirectionalLight(0xe0ebdf, 3.7);
    key.position.set(-40, 100, 80);
    const rim = new DirectionalLight(0x609fc0, 2.2);
    rim.position.set(20, 30, -60);
    this.scene.add(hemisphere, key, rim);
    this.observer = new ResizeObserver(() => this.resize(canvas));
    this.observer.observe(canvas);
    this.resize(canvas);
  }

  async init(): Promise<void> {
    await this.renderer.init();
    this.backend = 'isWebGPUBackend' in this.renderer.backend ? 'webgpu' : 'webgl2';
  }

  private resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.left = -this.viewWidth / 2;
    this.camera.right = this.viewWidth / 2;
    this.camera.updateProjectionMatrix();
  }

  get viewWidth(): number { return CONFIG.viewHeight * this.width / this.height; }

  /** Instantiate the alternate visual only if the experimental profile is used.
   * The default ship path allocates no helicopter meshes or materials.
   */
  private helicopterVisual(): HelicopterModel {
    if (!this.helicopter) {
      this.helicopter = createHelicopter();
      this.scene.add(this.helicopter.group);
    }
    return this.helicopter;
  }

  reset(state: FlightState, title: boolean): void {
    this.currentVehicle = state.vehicleId;
    this.rig.reset(state.player.x, title);
    if (state.vehicleId === 'helicopter') {
      const model = this.helicopterVisual();
      model.mainRotor.rotation.y = 0;
      model.tailRotor.rotation.z = 0;
    }
    // Avoid a transition frame containing BOTH models before the next draw.
    this.ship.group.visible = state.vehicleId === 'ship' && (state.player.alive || title);
    if (this.helicopter) this.helicopter.group.visible =
      state.vehicleId === 'helicopter' && (state.player.alive || title);
    this.facingAngle = state.player.facing === 1 ? 0 : Math.PI;
    this.frameTimes = [];
    if (state.seed !== this.seed) {
      this.scene.remove(this.world.group, this.world.backdrop);
      disposeTree(this.world.group); disposeTree(this.world.backdrop);
      this.seed = state.seed;
      this.world = new WorldScene(state.seed, this.landscapePreferences);
      this.scene.add(this.world.group, this.world.backdrop);
    }
    this.world.setLandscape(this.landscapePreferences, state.wave);
    this.updatePlayerLaser(state.wave);
  }

  setLandscape(preferences: LandscapePreferences, wave: number): void {
    this.landscapePreferences = preferences;
    this.world.setLandscape(preferences, wave);
    this.updatePlayerLaser(wave);
  }

  private updatePlayerLaser(wave: number): void {
    const { style } = resolveLandscape(this.landscapePreferences, wave, this.seed);
    const theme = adaptivePalette(style);
    this.combat.setExplosionColor(theme.hudInk);
    this.shotMaterial.color.set(theme.laser);
    this.shotOutlineMaterial.color.set(theme.laserOutline);
  }

  draw(state: FlightState, alpha: number, elapsed: number, active: boolean, title: boolean, reducedMotion: boolean): void {
    const p = state.player;
    const playerX = active ? wrappedLerp(p.previousX, p.x, alpha, CONFIG.worldWidth) : p.x;
    if (!title) this.rig.update(playerX, p.vx, p.facing, this.viewWidth, elapsed, reducedMotion);
    this.camera.position.x = this.rig.x;
    this.world.update(this.rig.x, this.viewWidth, state.missionMode, reducedMotion);
    this.combat.update(state, this.rig.x, this.viewWidth, reducedMotion, elapsed);
    this.currentVehicle = state.vehicleId;
    const helicopter = state.vehicleId === 'helicopter' ? this.helicopterVisual() : null;
    this.ship.group.visible = !helicopter && (p.alive || title);
    if (this.helicopter) this.helicopter.group.visible = Boolean(helicopter) && (p.alive || title);
    if (!reducedMotion) {
      const impact = state.events.find(e => ['player-hit', 'bomb'].includes(e.kind) && state.time - e.time < 0.45);
      if (impact) this.camera.position.x += Math.sin(state.time * 75) * (0.45 - (state.time - impact.time)) * 2;
    }
    this.renderer.toneMappingExposure = state.colonyLost ? 0.9 : 1.25;
    const y = active ? p.previousY + (p.y - p.previousY) * alpha : p.y;
    const x = nearCameraX(playerX, this.rig.x, CONFIG.worldWidth);
    const scale = title ? 2.1 : 1;
    if (helicopter) {
      helicopter.group.position.set(x, y, 0);
      // Bigger utility-helicopter silhouette: large enough to read from the
      // side-view camera, with landing wheels above the ground clearance.
      const helicopterScale = scale * 1.18;
      helicopter.group.scale.set(helicopterScale * p.facing, helicopterScale, helicopterScale);
      helicopter.group.rotation.y = 0;
      helicopter.group.rotation.x = reducedMotion ? 0 : p.vy * 0.004;
      helicopter.group.rotation.z = reducedMotion ? 0 : -p.vx * 0.0015;
      if (p.alive && active) animateHelicopter(helicopter, elapsed, reducedMotion);
    } else {
      // Preserve the established ship pose/exhaust calculations byte-for-byte.
      this.ship.group.position.set(x, y, 0);
      const targetAngle = p.facing === 1 ? 0 : Math.PI;
      this.facingAngle += (targetAngle - this.facingAngle) * (reducedMotion ? 1 : 1 - Math.exp(-24 * elapsed));
      // Mirror the silhouette while keeping its readable, detailed side toward the camera.
      this.ship.group.scale.set(scale * p.facing, scale, scale);
      this.ship.group.rotation.y = Math.sin(this.facingAngle) * 0.3;
      this.ship.group.rotation.x = 0.24 + (reducedMotion ? 0 : p.vy * 0.006);
      this.ship.group.rotation.z = reducedMotion ? 0 : p.vy * 0.0018 * p.facing;
      this.ship.thrust.value = reducedMotion ? 0.5 : 0.55 + p.thrust * 0.4;
      for (const plume of this.ship.exhausts) {
        const length = 2.5 + p.thrust * 5;
        plume.scale.set(length, 0.65 + p.thrust * 0.18, 1);
        plume.position.x = -4.56 - length / 2;
      }
    }
    const ids = new Set(state.shots.map(shot => shot.id));
    for (const [id, mesh] of this.shots) {
      if (!ids.has(id)) { this.scene.remove(mesh); this.shots.delete(id); }
    }
    for (const shot of state.shots) {
      let mesh = this.shots.get(shot.id);
      if (!mesh) {
        mesh = new Mesh(this.shotGeometry, this.shotMaterial);
        const outline = new Mesh(this.shotOutlineGeometry, this.shotOutlineMaterial);
        outline.name = 'player-shot-outline';
        outline.position.z = -0.13;
        mesh.add(outline);
        this.shots.set(shot.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(nearCameraX(shot.x, this.rig.x, CONFIG.worldWidth), shot.y, 0.8);
      mesh.material = shot.team === 'enemy' ? this.hostileShotMaterial : this.shotMaterial;
      mesh.getObjectByName('player-shot-outline')!.visible = shot.team === 'player';
      mesh.scale.set(shot.team === 'enemy' ? 0.4 : 1, shot.team === 'enemy' ? 4 : 1, 1);
      mesh.rotation.z = Math.atan2(shot.vy, shot.vx);
    }
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (elapsed > 0 && elapsed < 0.5) {
      this.frameTimes.push(elapsed);
      if (this.frameTimes.length > 180) this.frameTimes.shift();
    }
  }

  metrics(): RenderMetrics {
    const seconds = this.frameTimes.reduce((a, b) => a + b, 0) / (this.frameTimes.length || 1);
    const info = this.renderer.info;
    return { backend: this.backend, fps: seconds ? 1 / seconds : 0, frameMs: seconds * 1000,
      drawCalls: info.render.drawCalls, triangles: info.render.triangles,
      geometries: info.memory.geometries, textures: info.memory.textures,
      width: this.width, height: this.height, pixelRatio: this.renderer.getPixelRatio(),
      cameraX: this.rig.x, viewWidth: this.viewWidth, vehicleId: this.currentVehicle,
      renderedModel: this.helicopter?.group.visible ? 'helicopter' : 'ship' };
  }

  dispose(): void {
    this.observer.disconnect();
    disposeTree(this.scene);
    this.shotGeometry.dispose(); this.shotOutlineGeometry.dispose();
    this.shotMaterial.dispose(); this.shotOutlineMaterial.dispose();
    this.hostileShotMaterial.dispose();
    this.renderer.dispose();
  }
}
