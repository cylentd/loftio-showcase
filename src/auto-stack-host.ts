import { AUTO_STACK } from "./auto-stack-data";
import type { AutoStackHost } from "./auto-stacker";
import { floorPosition, isSitting, surfaceAt } from "./resident-movement";
import { PLACEMENT } from "./resident-movement-data";
import type { Resident } from "./resident";
import type { ResidentStacks } from "./resident-stacks";
import type { Scene } from "./scene";
import { ROUTINE } from "./tune";

/** Only a resident at rest on the floor takes part: not held, falling, walking, on a ladder, seated, or already in a pile. */
function isFree(r: Resident, stacks: ResidentStacks): boolean {
  return !r.held && !r.falling && !r.walking && !r.climbing && !r.ladderReserved && r.seatSupport.lift === 0 && !isSitting(r.pos)
    && !stacks.contains(r) && r.pos.y >= PLACEMENT.back && r.pos.y <= PLACEMENT.front;
}

/** Connects the self-stacking dice to the real residents and their piles. */
export function lobbyAutoHost(scene: Scene, stacks: ResidentStacks): AutoStackHost {
  const find = (id: string) => scene.residents.find(r => r.cast.id === id);
  return {
    actors: () => scene.residents.map(r => ({ id: r.cast.id, x: r.pos.x, y: r.pos.y, surface: surfaceAt(r.pos),
      free: isFree(r, stacks), walking: r.walking, held: r.held })),
    walkNear(id, baseId) {
      const climber = find(id), base = find(baseId);
      if (!climber || !base || scene.residents.filter(r => r.walking).length >= ROUTINE.maxMoving) return false;
      const side = climber.pos.x < base.pos.x ? -1 : 1;
      const spot = floorPosition({ x: base.pos.x + side * AUTO_STACK.standOff, y: base.pos.y }, surfaceAt(base.pos));
      return climber.walkTo(spot, "home", false, scene.residents.filter(r => r !== climber).flatMap(r => r.seatClaims));
    },
    join: (id, baseId) => { const climber = find(id), base = find(baseId); return !!climber && !!base && !climber.held && stacks.autoJoin(climber, base); },
    pileSize: id => { const r = find(id); return r ? stacks.size(r) : 0; },
  };
}
