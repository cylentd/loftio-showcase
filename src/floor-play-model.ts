import { FLOOR_PLAY as P } from "./floor-play-data.ts";
import { PLACEMENT as FLOOR } from "./resident-movement-data.ts";
import { TRAVEL_OBSTACLES } from "./travel-data.ts";

export type FloorBody = { x: number; y: number; z: number; vx: number; vy: number; vz: number; radius: number; edgeRadius?: number; impact: number; asleep: boolean };
export type FloorView = { left: number; right: number };
export function floorBody(x: number, y: number, radius: number): FloorBody {
  return { x, y, z: 0, vx: 0, vy: 0, vz: 0, radius, impact: 0, asleep: true };
}
export function launchFloor(b: FloorBody, velocity: { x: number; y: number }): void {
  b.vx = velocity.x * P.flickGain; b.vy = velocity.y * P.flickGain * P.depthScale;
  b.vz = Math.min(P.maxTossSpeed, P.hopSpeed + Math.max(0, -velocity.y) * P.upwardGain); b.asleep = false;
}

function limits(b: FloorBody, view?: FloorView) {
  const depth = Math.max(0, Math.min(1, (b.y - FLOOR.back) / (FLOOR.front - FLOOR.back)));
  const inset = b.edgeRadius ?? b.radius;
  const left = Math.max(FLOOR.backLeft + (FLOOR.frontLeft - FLOOR.backLeft) * depth + b.radius, (view?.left ?? -Infinity) + inset);
  const right = Math.min(FLOOR.backRight + (FLOOR.frontRight - FLOOR.backRight) * depth - b.radius, (view?.right ?? Infinity) - inset);
  return { left, right: Math.max(left, right), back: FLOOR.back + b.radius * P.depthScale, front: FLOOR.front - b.radius * P.depthScale };
}

/** Resolve feet against the painted floor and existing table footprints. */
export function fitFloor(b: FloorBody, view?: FloorView): void {
  const edge = limits(b, view);
  if (b.y < edge.back) { b.y = edge.back; b.vy = Math.abs(b.vy) * P.bounce; b.impact = 1; }
  if (b.y > edge.front) { b.y = edge.front; b.vy = -Math.abs(b.vy) * P.bounce; b.impact = 1; }
  if (b.x < edge.left) { b.x = edge.left; b.vx = Math.abs(b.vx) * P.bounce; b.impact = 1; }
  if (b.x > edge.right) { b.x = edge.right; b.vx = -Math.abs(b.vx) * P.bounce; b.impact = 1; }
  for (const obstacle of TRAVEL_OBSTACLES) {
    const left = obstacle.left - b.radius, right = obstacle.right + b.radius;
    const back = obstacle.back - b.radius * P.depthScale, front = obstacle.front + b.radius * P.depthScale;
    if (b.x <= left || b.x >= right || b.y <= back || b.y >= front) continue;
    const exits = [
      { x: left, y: b.y, vx: -Math.abs(b.vx) * P.bounce, vy: b.vy },
      { x: right, y: b.y, vx: Math.abs(b.vx) * P.bounce, vy: b.vy },
      { x: b.x, y: back, vx: b.vx, vy: -Math.abs(b.vy) * P.bounce },
      { x: b.x, y: front, vx: b.vx, vy: Math.abs(b.vy) * P.bounce },
    ].filter(p => p.x >= edge.left && p.x <= edge.right && p.y >= edge.back && p.y <= edge.front);
    exits.sort((a, c) => Math.hypot(a.x - b.x, (a.y - b.y) / P.depthScale) - Math.hypot(c.x - b.x, (c.y - b.y) / P.depthScale));
    if (exits[0]) { Object.assign(b, exits[0]); b.impact = 1; }
  }
}

function advance(b: FloorBody, dt: number, view?: FloorView): void {
  b.impact = Math.max(0, b.impact - dt * P.impactDecay);
  if (b.asleep) return;
  const drag = Math.exp(-P.friction * dt); b.vx *= drag; b.vy *= drag;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.vz -= P.gravity * dt; b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    if (b.vz < -P.stopHop) { b.impact = 1; b.vz *= -P.hopBounce; }
    else b.vz = 0;
  }
  fitFloor(b, view);
  if (Math.hypot(b.vx, b.vy / P.depthScale) < P.stopSpeed && b.z === 0 && b.vz === 0) {
    b.vx = b.vy = 0; b.asleep = true;
  }
}

function bump(a: FloorBody, b: FloorBody): void {
  if (a.asleep && b.asleep) return;
  // High carries do not hit a neighbor standing underneath them.
  if (Math.abs(a.z - b.z) > a.radius + b.radius) return;
  const dx = b.x - a.x, dy = (b.y - a.y) / P.depthScale, distance = Math.hypot(dx, dy);
  const reach = a.radius + b.radius;
  if (distance >= reach) return;
  const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
  const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) / P.depthScale * ny;
  if (closing >= 0) return;
  const impulse = -(1 + P.bounce) * closing / 2, separation = (reach - distance) / 2;
  a.x -= nx * separation; a.y -= ny * separation * P.depthScale;
  b.x += nx * separation; b.y += ny * separation * P.depthScale;
  a.vx -= nx * impulse; a.vy -= ny * impulse * P.depthScale;
  b.vx += nx * impulse; b.vy += ny * impulse * P.depthScale;
  a.asleep = b.asleep = false; a.impact = b.impact = 1;
}

export function stepFloor(bodies: FloorBody[], milliseconds: number, view?: FloorView,
  capture?: (previous: FloorBody, current: FloorBody) => boolean): void {
  let active = bodies;
  let remaining = Math.min(P.maxFrameMs, Math.max(0, milliseconds));
  while (remaining > 0) {
    const step = Math.min(P.stepMs, remaining); remaining -= step;
    const previous = capture ? new Map(active.map(b => [b, { ...b }])) : null;
    for (const b of active) advance(b, step / P.seconds, view);
    if (capture && previous) active = active.filter(b => !capture(previous.get(b)!, b));
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) bump(active[i]!, active[j]!);
    for (const b of active) if (!b.asleep) fitFloor(b, view);
  }
}
