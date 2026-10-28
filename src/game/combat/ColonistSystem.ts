import { wrapX } from '../../core/WorldWrap';
import { CONFIG, SAFE_BASE } from '../config';
import { vehicleProfile } from '../VehicleProfile';
import { COMBAT } from './types';
import type { CombatContext, Enemy } from './types';
import { deltaX, sweptHit } from './spatial';

export function startPlayerExtraction(ctx: CombatContext): boolean {
  const s = ctx.state, p = s.player, rescue = vehicleProfile(s.vehicleId).rescue;
  const passengers = s.colonists.filter(c => c.status === 'carried').length;
  if (s.missionMode !== 'rescue' || !p.alive || s.outcome !== 'active' || s.colonists.some(c => c.status === 'extracting')
    || passengers >= s.colonists.length || (rescue.capacity !== null && passengers >= rescue.capacity)
    || (rescue.maxPickupSpeed !== null && Math.abs(p.vx) > rescue.maxPickupSpeed)) return false;
  const target = s.colonists
    .filter(c => c.status === 'ground' && c.owner === null
      && Math.abs(deltaX(p.x, c.x)) <= rescue.pickupRange
      && p.y >= c.y + rescue.minPickupHeight && p.y - c.y <= rescue.maxPickupHeight)
    .sort((a, b) => Math.hypot(deltaX(p.x, a.x), p.y - a.y) - Math.hypot(deltaX(p.x, b.x), p.y - b.y))[0];
  if (!target) return false;
  target.status = 'extracting'; target.onboard = false; target.owner = null; target.vy = 0;
  ctx.emit('extraction', target.x, target.y);
  return true;
}

export function releaseTarget(ctx: CombatContext, enemy: Enemy): void {
  const colonist = ctx.state.colonists.find(c => c.id === enemy.target && c.owner === enemy.id);
  if (colonist && colonist.status !== 'lost') {
    const captured = colonist.status === 'captured';
    colonist.status = captured ? 'falling' : 'ground';
    colonist.vy = 0; colonist.owner = null;
    if (captured) ctx.emit('falling', colonist.x, colonist.y);
  }
  enemy.target = null;
}

export function updateColonists(ctx: CombatContext, dt: number, beamHeld = false): void {
  const s = ctx.state, p = s.player, rescue = vehicleProfile(s.vehicleId).rescue;
  let carriedIndex = 0;
  for (const c of s.colonists) {
    if (c.status === 'lost') continue;
    if (c.status !== 'falling') c.crashSafeLanding = false;
    if (c.owner !== null && !s.enemies.some(e => e.id === c.owner && e.hp > 0)) {
      c.owner = null; c.status = c.status === 'captured' ? 'falling' : 'ground'; c.vy = 0;
    }
    if (c.status === 'ground') {
      if (Math.abs(deltaX(c.homeX, c.x)) > 4) c.walkDirection *= -1;
      c.x = wrapX(c.x + c.walkDirection * 0.8 * dt, CONFIG.worldWidth);
      c.y = ctx.terrain.height(c.x) + 1.5;
    }
    if (c.status === 'targeted' || c.status === 'safe') c.y = ctx.terrain.height(c.x) + 1.5;
    if (c.status === 'falling') {
      const oldY = c.y;
      c.vy -= COMBAT.gravity * dt;
      c.y += c.vy * dt;
      // Sweep relative player/colonist motion to catch fast passes reliably.
      const hasRoom = rescue.capacity === null
        || s.colonists.filter(other => other.status === 'carried').length < rescue.capacity;
      const hit = hasRoom && p.alive && sweptHit(p.previousX, p.previousY,
        deltaX(p.previousX, p.x), p.y - p.previousY - (c.y - oldY), { x: c.x, y: oldY }, COMBAT.rescueRadius) !== null;
      if (hit) {
        c.status = 'carried'; c.vy = 0; c.crashSafeLanding = false;
        c.onboard = s.missionMode === 'rescue' || s.vehicleId === 'helicopter';
        if (!c.rescued) { s.score += COMBAT.catchPoints; c.rescued = true; }
        ctx.emit('rescue', c.x, c.y);
      } else if (c.y <= ctx.terrain.height(c.x) + 1.5) {
        c.y = ctx.terrain.height(c.x) + 1.5;
        c.status = c.crashSafeLanding || Math.abs(c.vy) <= COMBAT.safeFallSpeed ? 'ground' : 'lost';
        c.crashSafeLanding = false;
        c.vy = 0; ctx.emit(c.status === 'lost' ? 'lost' : 'landing', c.x, c.y);
      }
    }
    if (c.status === 'extracting') {
      // The beam works ONLY while action is held; an interrupted lift releases
      // the colonist into the existing falling/landing rescue physics.
      if (!p.alive || !beamHeld || Math.abs(deltaX(c.x, p.x)) > 18
        || p.y < c.y + (s.vehicleId === 'helicopter' ? 0.5 : 1)
        || (rescue.maxPickupSpeed !== null && Math.abs(p.vx) > rescue.maxPickupSpeed)) {
        c.status = 'falling'; c.vy = 0;
        ctx.emit('falling', c.x, c.y);
        continue;
      }
      // A helicopter boards passengers through its cabin close to the wheels;
      // the original spacecraft still pulls them to its lower beam emitter.
      const targetX = wrapX(p.x, CONFIG.worldWidth);
      const targetY = s.vehicleId === 'helicopter' ? p.y - 0.5 : p.y - 2.6;
      const dx = deltaX(c.x, targetX), dy = targetY - c.y;
      const stepX = rescue.extractionHorizontalSpeed * dt;
      const stepY = rescue.extractionSpeed * dt;
      c.x = wrapX(c.x + Math.max(-stepX, Math.min(stepX, dx)), CONFIG.worldWidth);
      c.y += Math.max(-stepY, Math.min(stepY, dy));
      if (Math.abs(deltaX(c.x, targetX)) < 0.45 && Math.abs(c.y - targetY) < 0.45) {
        c.status = 'carried'; c.vy = 0; c.onboard = true;
        if (!c.rescued) { s.score += COMBAT.catchPoints; c.rescued = true; }
        ctx.emit('rescue', c.x, c.y);
      }
    }
    if (c.status === 'carried') {
      if (!p.alive) { c.status = 'falling'; c.vy = 0; continue; }
      if (s.missionMode === 'rescue' || s.vehicleId === 'helicopter') {
        // Rescue-mode ship passengers and all helicopter passengers board inside.
        c.onboard = true; c.x = p.x; c.y = p.y;
      } else {
        c.onboard = false;
        c.x = wrapX(p.x - carriedIndex * 2.5 * p.facing, CONFIG.worldWidth);
        c.y = p.y - 3.2 - carriedIndex * 0.3;
      }
      carriedIndex++;
      const insideSafeBase = Math.abs(deltaX(p.x, SAFE_BASE.x)) <= SAFE_BASE.radius;
      const validZone = s.missionMode === 'defense' || insideSafeBase;
      if (validZone && p.y <= ctx.terrain.height(p.x) + 6 && Math.abs(p.vx) <= rescue.deliverySpeed && Math.abs(p.vy) < 12) {
        if (s.missionMode === 'rescue') {
          c.x = wrapX(SAFE_BASE.x + ((s.delivered % 5) - 2) * 2.3, CONFIG.worldWidth);
          c.homeX = c.x;
        }
        c.status = 'safe'; c.onboard = false; c.y = ctx.terrain.height(c.x) + 1.5;
        s.delivered++; s.score += COMBAT.deliveryPoints * Math.min(s.delivered, 4);
        s.portal.ready = true; ctx.emit('delivery', c.x, c.y);
      }
    }
  }
  if (s.colonists.length > 0 && s.colonists.every(c => c.status === 'lost') && !s.colonyLost) {
    s.colonyLost = true;
    ctx.emit('lost', p.x, p.y);
  }
}
