/** Self-made piles: residents occasionally stack themselves while wandering. Calm and rare on purpose (owner, 2026-11-08). */
export const AUTO_STACK = {
  maxHeight: 3, // owner's cap for a pile residents make alone; a player may still add up to STACK.maxResidents
  decisionMs: 8000, // one roll per this long; matches ROUTINE.minGapMs, the shortest gap between wander decisions
  chance: 0.12, // share of rolls that start a pile: about one pile per 70 s awake before the cooldown, felt as a surprise
  cooldownMs: 90000, // quiet time after a pile ends, so piles never chain
  thirdChance: 0.4, // share of piles that recruit a third resident
  lifetimeMs: 12000, // how long a pile stands before the residents climb down
  descendStepMs: 700, // gap between one resident stepping off and the next (about one hop, HOP.durationMs)
  descendOffset: 60, // px sideways a resident lands from the pile, so it does not stand on its neighbour
  reachX: 420, // farthest partner in px along the floor; about one third of the room width
  reachY: 120, // farthest partner in floor depth px, so the walk stays on one lane
  standOff: 70, // px beside the base a climber walks to before climbing on
  giveUpMs: 15000, // a walk that has not arrived by now is abandoned
  seed: 20261108, // fixed seed: the same room rolls the same way each load
} as const;
