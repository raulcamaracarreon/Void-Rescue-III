import {
  Color, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D,
  PlaneGeometry, SphereGeometry, TorusGeometry,
} from 'three/webgpu';
import { color, float, materialOpacity, sin, smoothstep, uniform, uv } from 'three/tsl';
import type { FlightState } from '../game/Simulation';
import type { EnemyKind, GameEvent } from '../game/combat/types';
import { nearCameraX } from '../core/WorldWrap';
import { CONFIG } from '../game/config';
import { colonistModel, enemyModel } from './models/CombatModels';
import { emission } from './materials';
import { DestructionEffects } from './DestructionEffects';

export class CombatVisuals {
  readonly group = new Group();
  private readonly colonistTemplate = colonistModel();
  private readonly templates = new Map<EnemyKind, Group>();
  private readonly entities = new Map<number, Group>();
  private readonly beams = new Map<number, Mesh>();
  private readonly beamGeometry = new PlaneGeometry(1, 1);
  private readonly beamMaterial = new MeshBasicNodeMaterial({ color: 0xc6a6ff, transparent: true, opacity: 0.16, depthWrite: false, side: DoubleSide });
  private readonly tractorMaterial = new MeshBasicNodeMaterial({ color: 0x7dffe0, transparent: true, opacity: 0.24, depthWrite: false, side: DoubleSide });
  private readonly tractorBeam = new Mesh(this.beamGeometry, this.tractorMaterial);
  private readonly portal = new Group();
  private readonly shield: Mesh;
  private readonly particles: InstancedMesh;
  private readonly helper = new Object3D();
  private readonly rings: Mesh[] = [];
  private readonly effectTime = uniform(0);
  particleCount = 0;
  private readonly destruction = new DestructionEffects();
  private presentationTime = 0;

  setExplosionColor(hex: string): void { this.destruction.setExplosionColor(hex); }

  constructor() {
    this.group.add(this.destruction.group);
    this.tractorBeam.visible = false; this.group.add(this.tractorBeam);
    for (const kind of ['harvester', 'wraith', 'interceptor', 'flux', 'drone', 'crossfire'] as const) this.templates.set(kind, enemyModel(kind));
    for (let i = 0; i < 3; i++) {
      const ring = new Mesh(new TorusGeometry(7 - i * 0.5, 0.22, 8, 48), emission(i === 1 ? 0xb590ff : 0x98f6eb));
      ring.position.z = -i * 1.8; ring.rotation.y = 0.15 + i * 0.09; this.portal.add(ring);
    }
    const field = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    const radius = uv().sub(0.5).length();
    field.colorNode = color('#60dccc').mul(sin(radius.mul(65).sub(this.effectTime.mul(3))).mul(0.25).add(0.65));
    field.opacityNode = float(1).sub(smoothstep(0.37, 0.49, radius)).mul(0.3);
    const disc = new Mesh(new PlaneGeometry(13, 13), field); disc.position.z = -2; this.portal.add(disc);
    this.group.add(this.portal);
    this.shield = new Mesh(new SphereGeometry(5.3, 16, 12), new MeshBasicNodeMaterial({ color: 0x8ae4d6, wireframe: true, transparent: true, opacity: 0.15, depthWrite: false }));
    this.shield.scale.y = 0.55; this.group.add(this.shield);
    this.particles = new InstancedMesh(new SphereGeometry(1, 4, 3), emission(0xffffff), 160);
    this.particles.frustumCulled = false; this.particles.count = 0; this.group.add(this.particles);
    for (let i = 0; i < 12; i++) {
      const material = new MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
      const edge = uv().sub(0.5).length();
      material.opacityNode = smoothstep(0.42, 0.47, edge).mul(float(1).sub(smoothstep(0.47, 0.5, edge))).mul(materialOpacity);
      const ring = new Mesh(new PlaneGeometry(2, 2), material); ring.visible = false;
      this.rings.push(ring); this.group.add(ring);
    }
  }

  update(state: FlightState, cameraX: number, width: number, reduced: boolean, elapsed = 0): void {
    this.group.visible = state.enabled;
    if (!state.enabled) return;
    this.presentationTime = state.outcome === 'active' ? state.time : Math.max(state.time, this.presentationTime) + elapsed;
    this.effectTime.value = reduced ? 0 : state.time;
    const x = (worldX: number) => nearCameraX(worldX, cameraX, CONFIG.worldWidth);
    const visible = (worldX: number) => Math.abs(x(worldX) - cameraX) < width / 2 + 20;
    const liveIds = new Set<number>();
    for (const c of state.colonists) {
      if (c.status === 'lost') continue;
      liveIds.add(c.id);
      let model = this.entities.get(c.id);
      if (!model || model.userData.kind !== 'colonist') { if (model) this.group.remove(model); model = this.colonistTemplate.clone(); model.userData.kind = 'colonist'; this.entities.set(c.id, model); this.group.add(model); }
      model.position.set(x(c.x), c.y, 12);
      // Rescued colonists board the ship rather than dangling beneath it.
      model.visible = visible(c.x) && !c.onboard;
      const walk = c.status === 'ground' ? Math.sin(state.time * 8 + c.id) * 0.3 : 0;
      model.getObjectByName('leg-left')!.rotation.z = walk; model.getObjectByName('leg-right')!.rotation.z = -walk;
      const beacon = model.getObjectByName('beacon')!;
      beacon.scale.setScalar(c.status === 'falling' || c.status === 'captured' ? 1.35 : 1);
      beacon.visible = c.status !== 'safe';
    }
    for (const e of state.enemies) {
      liveIds.add(e.id);
      let model = this.entities.get(e.id);
      if (!model || model.userData.kind !== e.kind) { if (model) this.group.remove(model); model = this.templates.get(e.kind)!.clone(); model.userData.kind = e.kind; this.entities.set(e.id, model); this.group.add(model); }
      model.position.set(x(e.x), e.y, 1); model.visible = visible(e.x);
      model.scale.setScalar(e.telegraph > 0 ? Math.max(0.1, 1 - e.telegraph / 0.65) : 1);
      if (e.kind === 'interceptor') {
        // Turn through the ship's side rather than mirroring its silhouette in one frame.
        const direction = e.vx >= 0 ? 1 : -1;
        const current = typeof model.userData.heading === 'number' ? model.userData.heading as number : direction;
        const turn = 1 - Math.exp(-5 * Math.min(0.1, Math.max(0, elapsed)));
        const heading = current + (direction - current) * (reduced ? 1 : turn);
        model.userData.heading = heading;
        model.scale.x *= heading >= 0 ? 1 : -1;
        model.rotation.y = reduced ? 0 : (1 - Math.abs(heading)) * Math.PI / 2;
      }
      model.rotation.z = reduced ? 0 : e.kind === 'flux' ? Math.sin(e.age) * 0.1 : Math.max(-0.2, Math.min(0.2, e.vy * 0.01));
      const c = state.colonists.find(c => c.id === e.target);
      let beam = this.beams.get(e.id);
      if (c && (e.phase === 'lift' || e.phase === 'descend')) {
        if (!beam) { beam = new Mesh(this.beamGeometry, this.beamMaterial); this.beams.set(e.id, beam); this.group.add(beam); }
        const dx = nearCameraX(c.x, e.x, CONFIG.worldWidth) - e.x, dy = e.y - c.y;
        beam.visible = model.visible; beam.position.set(x(e.x) + dx / 2, (e.y + c.y) / 2, 0.5);
        beam.rotation.z = Math.atan2(dx, dy);
        beam.scale.set(2.2, Math.max(0.1, Math.hypot(dx, dy)), 1);
      } else if (beam) beam.visible = false;
    }
    for (const [id, model] of this.entities) if (!liveIds.has(id)) { this.group.remove(model); this.entities.delete(id); }
    for (const [id, beam] of this.beams) if (!liveIds.has(id)) { this.group.remove(beam); this.beams.delete(id); }
    const extracting = state.colonists.find(c => c.status === 'extracting');
    if (extracting) {
      const colonistX = x(extracting.x), playerX = x(state.player.x);
      const dx = playerX - colonistX, dy = state.player.y - extracting.y;
      this.tractorBeam.visible = visible(extracting.x);
      this.tractorBeam.position.set((colonistX + playerX) / 2, (extracting.y + state.player.y) / 2, 10);
      this.tractorBeam.rotation.z = Math.atan2(dx, dy);
      // Helicopter: narrow winch cable. Classic ship: original broad beam.
      this.tractorBeam.scale.set(state.vehicleId === 'helicopter' ? 0.32
        : 2.8 + Math.sin(state.time * 20) * 0.3, Math.max(0.1, Math.hypot(dx, dy)), 1);
      this.tractorMaterial.color.setHex(state.vehicleId === 'helicopter' ? 0xd4d9b8 : 0x7dffe0);
    } else this.tractorBeam.visible = false;
    this.portal.visible = state.portal.ready && visible(state.portal.x);
    this.portal.position.set(x(state.portal.x), state.portal.y, -1);
    this.portal.rotation.z = reduced ? 0 : Math.sin(state.time * 0.7) * 0.06;
    this.shield.visible = state.player.alive && state.player.invulnerable > 0;
    this.shield.position.set(x(state.player.x), state.player.y, 1);
    this.effects(state, cameraX, reduced);
    this.destruction.update(state.events, this.presentationTime, cameraX, width, reduced);
    this.particleCount += this.destruction.count;
  }

  private effects(state: FlightState, cameraX: number, reduced: boolean): void {
    let count = 0, ringIndex = 0;
    this.rings.forEach(ring => { ring.visible = false; });
    for (const event of state.events) {
      const age = this.presentationTime - event.time;
      if (age < 0 || age > 1.1) continue;
      const locationX = nearCameraX(event.x, cameraX, CONFIG.worldWidth);
      const tint = new Color(this.eventColor(event));
      if (['bomb', 'bomb-charge', 'portal', 'rescue', 'delivery', 'mutation', 'impact'].includes(event.kind) && ringIndex < this.rings.length) {
        const ring = this.rings[ringIndex++]!;
        const size = event.kind === 'bomb' ? 4 + age * 130 : event.kind === 'bomb-charge' ? 4 - age * 8 : event.kind === 'impact' ? 0.4 + age * 3 : 2 + age * 9;
        ring.visible = size > 0; ring.position.set(locationX, event.y, 13); ring.scale.setScalar(Math.max(0.01, size));
        const material = ring.material as MeshBasicNodeMaterial;
        material.color.copy(tint); material.opacity = (1 - age / 1.1) * (reduced ? 0.18 : 0.45);
      }
      if (['lost', 'mutation'].includes(event.kind)) {
        const amount = reduced ? 4 : event.kind === 'impact' ? 4 : 14;
        for (let i = 0; i < amount && count < 160; i++) {
          const angle = (i / amount * Math.PI * 2) + event.id * 0.37;
          const speed = 6 + ((event.id * 13 + i * 7) % 14);
          this.helper.position.set(locationX + Math.cos(angle) * speed * age, event.y + Math.sin(angle) * speed * age - age * age * 6, 13);
          this.helper.scale.setScalar(Math.max(0.01, (1 - age) * (i % 3 ? 0.3 : 0.6)));
          this.helper.updateMatrix(); this.particles.setMatrixAt(count, this.helper.matrix); this.particles.setColorAt(count, tint); count++;
        }
      }
    }
    this.particleCount = count; this.particles.count = count; this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }

  private eventColor(event: GameEvent): number {
    return ['rescue', 'delivery', 'portal', 'respawn'].includes(event.kind) ? 0x9bffe3 : event.kind === 'mutation' ? 0xf28aff : 0xffb67a;
  }
}
