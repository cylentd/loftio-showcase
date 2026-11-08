import { FIDGET as F } from "./fidget-data.ts";

export type Sample = { x: number; y: number; time: number };
export type Bounds = { left: number; right: number; top: number; floor: number };
export type Body = { x: number; y: number; vx: number; vy: number; radius: number; mass: number; angle: number; impact: number; asleep: boolean };
export function flick(samples: readonly Sample[], now: number, scale: number): { x: number; y: number } | null {
  const last = samples.at(-1);
  if (!last || now - last.time > F.staleMs) return null;
  const first = samples.find(sample => sample.time >= last.time - F.sampleMs);
  if (!first || last.time <= first.time) return null;
  const elapsed = (last.time - first.time) / F.seconds;
  const x = (last.x - first.x) / elapsed, y = (last.y - first.y) / elapsed;
  const speed = Math.hypot(x, y);
  if (speed * scale < F.flickScreenSpeed) return null;
  const cap = Math.min(1, F.maxSpeed / speed);
  return { x: x * cap, y: y * cap };
}

function integrate(b: Body, dt: number, bounds: Bounds): void {
  b.impact = Math.max(0, b.impact - dt * F.impactDecay);
  if (b.asleep) return;
  b.vy += F.gravity * dt;
  b.vx *= Math.exp(-F.drag * dt);
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.angle += b.vx * F.spinScale * dt;
  if (b.x < bounds.left + b.radius || b.x > bounds.right - b.radius) {
    b.x = Math.max(bounds.left + b.radius, Math.min(bounds.right - b.radius, b.x));
    b.vx = b.x === bounds.left + b.radius ? Math.abs(b.vx) * F.bounce : -Math.abs(b.vx) * F.bounce;
    b.impact = 1;
  }
  if (b.y < bounds.top + b.radius) { b.y = bounds.top + b.radius; b.vy = Math.abs(b.vy) * F.bounce; b.impact = 1; }
  if (b.y >= bounds.floor - b.radius) {
    b.y = bounds.floor - b.radius;
    if (b.vy > F.stopSpeed) { b.vy *= -F.bounce; b.impact = 1; }
    else b.vy = 0;
    b.vx *= Math.exp(-F.floorDrag * dt);
    if (Math.abs(b.vx) < F.stopSpeed && b.vy === 0) { b.vx = 0; b.asleep = true; }
  }
}

function collide(a: Body, b: Body): void {
  if (a.asleep && b.asleep) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.hypot(dx, dy), radius = a.radius + b.radius;
  if (distance >= radius) return;
  const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
  const inverse = 1 / a.mass + 1 / b.mass;
  const overlap = (radius - distance) / inverse;
  a.x -= nx * overlap / a.mass; a.y -= ny * overlap / a.mass;
  b.x += nx * overlap / b.mass; b.y += ny * overlap / b.mass;
  const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (closing >= 0) return;
  const impulse = -(1 + F.bounce) * closing / inverse;
  a.vx -= impulse * nx / a.mass; a.vy -= impulse * ny / a.mass;
  b.vx += impulse * nx / b.mass; b.vy += impulse * ny / b.mass;
  a.asleep = b.asleep = false; a.impact = b.impact = 1;
}

export function stepBodies(bodies: Body[], milliseconds: number, bounds: Bounds = F): void {
  let remaining = Math.min(F.maxFrameMs, Math.max(0, milliseconds));
  while (remaining > 0) {
    const step = Math.min(F.stepMs, remaining); remaining -= step;
    for (const b of bodies) integrate(b, step / F.seconds, bounds);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) collide(bodies[i]!, bodies[j]!);
  }
}
export function body(x: number, radius: number, mass = 1): Body {
  return { x, y: F.floor - radius, radius, mass, vx: 0, vy: 0, angle: 0, impact: 0, asleep: true };
}
