import test from "node:test";
import assert from "node:assert/strict";
import { AutoStacker, type AutoActor, type AutoStackHost } from "../../src/auto-stacker.ts";
import { AUTO_STACK as A } from "../../src/auto-stack-data.ts";

type Fake = AutoActor & { walkingTo?: string };

/** A room of plain actors: walkers arrive when a test says so, joins are recorded. */
function room(count = 3, patch: Partial<Fake> = {}) {
  const actors: Fake[] = Array.from({ length: count }, (_, i) => ({
    id: `r${i}`, x: 1000 + i * 100, y: 900, surface: "ground", free: true, walking: false, held: false, ...patch,
  }));
  const log = { walks: [] as string[], joins: [] as string[], piled: new Set<string>() };
  const host: AutoStackHost = {
    actors: () => actors,
    walkNear: (id, baseId) => { const a = actors.find((x) => x.id === id)!; a.walking = true; a.free = false; a.walkingTo = baseId; log.walks.push(id); return true; },
    join: (id, baseId) => { log.joins.push(id); log.piled.add(id); log.piled.add(baseId); return true; },
    pileSize: (id) => (log.piled.has(id) ? log.piled.size : 0),
  };
  const arrive = (id: string) => { actors.find((x) => x.id === id)!.walking = false; };
  return { actors, log, host, arrive };
}
const always = (n: number) => () => n;
// AUTO_STACK is s const, so its thirdChance is typed 0.4; the tests need the other values.
const withThirdChance = (thirdChance: number) => ({ ...A, thirdChance }) as unknown as typeof A;
const decide = (s: AutoStacker, now: number) => s.update(A.decisionMs, now, true);

test("no pile forms while the gate is off, even when every roll succeeds", () => {
  const { host, log } = room();
  const s = new AutoStacker(host, always(0));
  for (let t = 1; t <= 20; t += 1) s.update(A.decisionMs, t * A.decisionMs, false);
  assert.deepEqual(log.walks, []);
  assert.deepEqual(log.joins, []);
});

test("a forced roll sends the nearest neighbour to the base, and it joins on arrival", () => {
  const { host, log, arrive } = room(3);
  const s = new AutoStacker(host, always(0), withThirdChance(0));
  decide(s, A.decisionMs);
  assert.deepEqual(log.walks, ["r1"]);
  assert.deepEqual(log.joins, []);
  arrive("r1");
  s.update(16, A.decisionMs + 16, true);
  assert.deepEqual(log.joins, ["r1"]);
});

test("a failed roll starts nothing", () => {
  const { host, log } = room();
  const s = new AutoStacker(host, always(0.99));
  decide(s, A.decisionMs);
  assert.deepEqual(log.walks, []);
});

test("a self-made pile recruits at most two climbers, however many residents are near", () => {
  const { host, log, arrive } = room(6);
  const s = new AutoStacker(host, always(0), withThirdChance(1));
  decide(s, A.decisionMs);
  assert.equal(log.walks.length, A.maxHeight - 1);
  log.walks.forEach(arrive);
  s.update(16, A.decisionMs + 16, true);
  assert.equal(log.joins.length, A.maxHeight - 1);
});

test("only free residents on the same surface within reach take part", () => {
  const { host, log, actors } = room(4);
  actors[1]!.free = false;
  actors[2]!.surface = "loft-left";
  actors[3]!.x += A.reachX * 2;
  const s = new AutoStacker(host, always(0), withThirdChance(1));
  decide(s, A.decisionMs);
  assert.deepEqual(log.walks, []);
});

test("the cooldown blocks a new pile until it has passed after the last one ends", () => {
  const { host, log, arrive } = room(3);
  const s = new AutoStacker(host, always(0), withThirdChance(0));
  decide(s, A.decisionMs);
  arrive("r1");
  s.update(16, 20000, true);
  assert.equal(log.joins.length, 1);
  log.piled.clear(); // the pile dissolved
  const ended = 30000;
  s.update(16, ended, true);
  log.walks.length = 0;
  for (let now = ended + A.decisionMs; now < ended + A.cooldownMs; now += A.decisionMs) s.update(A.decisionMs, now, true);
  assert.deepEqual(log.walks, []);
  s.update(A.decisionMs, ended + A.cooldownMs + A.decisionMs, true);
  assert.equal(log.walks.length, 1);
});

test("a base that starts walking, or a walk that never arrives, cancels the plan and starts the cooldown", () => {
  const { host, log, actors } = room(3);
  const s = new AutoStacker(host, always(0), withThirdChance(0));
  decide(s, A.decisionMs);
  actors[0]!.walking = true;
  s.update(16, A.decisionMs + 16, true);
  actors[0]!.walking = false;
  log.walks.length = 0;
  s.update(A.decisionMs, A.decisionMs + 2 * A.decisionMs, true);
  assert.deepEqual(log.walks, []);
  assert.deepEqual(log.joins, []);
});

test("a reset drops the plan, so a climber that arrives later is not joined", () => {
  const { host, log, arrive } = room(3);
  const s = new AutoStacker(host, always(0), withThirdChance(0));
  decide(s, A.decisionMs);
  s.reset();
  arrive("r1");
  s.update(16, A.decisionMs + 16, true);
  assert.deepEqual(log.joins, []);
});

test("a grabbed climber drops out of the plan and is never joined", () => {
  const { host, log, actors, arrive } = room(3);
  const s = new AutoStacker(host, always(0), withThirdChance(0));
  decide(s, A.decisionMs);
  actors[1]!.held = true;
  arrive("r1");
  s.update(16, A.decisionMs + 16, true);
  assert.deepEqual(log.joins, []);
});
