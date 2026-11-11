import type { Position } from './registry.ts';
import { DELIVERY as TUNE } from './delivery-constants.ts';
import { floorBody, launchFloor, stepFloor, type FloorBody } from '../floor-play-model.ts';
import { FLOOR_PLAY } from '../floor-play-data.ts';
import { flick, type Sample } from '../fidget-model.ts';
import { FIDGET } from '../fidget-data.ts';

type Phase = 'resting' | 'falling' | 'held';

export function deliveryMotion(origin: Position, constrain: (point: Position, anchor?: Position) => Position, land: (point: Position) => Position = constrain) {
  let ground = land(constrain(origin)), point = { ...ground }, phase: Phase = 'resting';
  let home = { ...ground }, impacts = 0, flight: FloorBody | null = null, samples: Sample[] = [], tossed = false;
  const rest = () => { point = constrain(ground); ground = { ...point }; flight = null; tossed = false; phase = 'resting'; };
  const resolve = (body: FloorBody) => {
    const next = constrain({ x: body.x, y: body.y }, tossed ? ground : undefined);
    if (next.x !== body.x) { body.vx *= -FLOOR_PLAY.bounce; body.impact = 1; }
    if (next.y !== body.y) { body.vy *= -FLOOR_PLAY.bounce; body.impact = 1; }
    body.x = next.x; body.y = next.y;
  };
  return {
    state: () => ({ point: { ...point }, ground: { ...ground }, phase, impacts,
      tilt: flight ? Math.max(-1, Math.min(1, flight.vx / FLOOR_PLAY.leanSpeed)) * FLOOR_PLAY.maxLean * TUNE.tiltDegrees / Math.PI : 0 }),
    arrive(animate: boolean) {
      rest();
      if (animate) {
        flight = floorBody(ground.x, ground.y, 0); flight.z = TUNE.dropHeight; flight.asleep = false;
        point.y -= flight.z; phase = 'falling';
      }
    },
    hold() { home = { ...ground }; phase = 'held'; flight = null; samples = []; },
    move(next: Position, time: number) {
      ground = constrain(next);
      point = { x: ground.x, y: Math.min(next.y, ground.y) };
      samples.push({ ...point, time });
      samples = samples.filter(sample => sample.time >= time - FIDGET.sampleMs);
    },
    release(time: number, animate: boolean, lift = 0, scale = 1) {
      ground = land(ground);
      if (!animate) { rest(); return; }
      flight = floorBody(ground.x, ground.y, 0);
      flight.z = Math.max(0, ground.y - point.y + lift); flight.asleep = false;
      point = { x: ground.x, y: ground.y - flight.z };
      const velocity = flick(samples, time, scale);
      tossed = velocity !== null;
      if (velocity) launchFloor(flight, velocity);
      samples = []; phase = 'falling';
    },
    cancel() { ground = home; rest(); samples = []; },
    place(next: Position) { ground = land(constrain(next)); rest(); },
    step(elapsed: number) {
      if (phase !== 'falling' || !flight) return;
      const impact = flight.impact;
      stepFloor([flight], elapsed * TUNE.seconds, { left: -Infinity, right: Infinity, resolve });
      if (flight.impact > impact) impacts += 1;
      ground = { x: flight.x, y: flight.y };
      point = { x: flight.x, y: flight.y - flight.z };
      if (flight.asleep) rest();
    },
  };
}
