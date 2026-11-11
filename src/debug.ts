import type { Application } from "pixi.js";
import type { Scene } from "./scene";
import type { Runtime } from "./runtime";
import type { Look } from "./look";
import { makeMeter } from "./meter";
const DEBUG_FRAME_MS = 16;

export function installDebug(shell: HTMLElement, app: Application, scene: Scene, runtime: Runtime, look: Look): void {
  makeMeter(shell, app.ticker, () => scene.residents.filter((r) => r.walking).length);
  Object.assign(window, { __grove: {
    snapshot: () => ({ clock: runtime.clock, camera: { x: look.x, y: look.y }, frozen: look.frozen,
      fidget: runtime.play?.snapshot() ?? null,
      favoriteLighting: { active: scene.favoriteScenery.active },
      lighting: { blend: scene.lighting.timeline.blend, elapsed: scene.lighting.timeline.elapsed, flickers: [...scene.lighting.flickers] },
      residents: scene.residents.map((resident) => ({ id: resident.cast.id, x: resident.pos.x, y: resident.pos.y, home: { ...resident.home }, wanderAfter: resident.wanderAfter, held: resident.held, placed: resident.placed, walking: resident.walking, climbing: resident.climbing, ladderReserved: resident.ladderReserved, depth: resident.root.zIndex, height: resident.height })),
      frame: { scale: look.scale, left: look.left + look.x * look.scale, top: look.offsetY - look.y * look.scale } }),
    advanceFrames: (count: number, render = true) => { for (let frame = 0; frame < count; frame += 1) runtime.update(DEBUG_FRAME_MS, false); runtime.update(0, render); if (render) app.render(); },
    actorPose: (index: number) => {
      const actor = scene.actors[index];
      if (!actor) throw new Error("Unknown scene actor");
      const body = actor.children.at(-1)!;
      const shadow = actor.children[0]!;
      return { rotation: body.rotation, lift: -body.y, ground: { x: actor.x, y: actor.y },
        shadow: { x: actor.x + shadow.x, y: actor.y + shadow.y, alpha: shadow.alpha, width: shadow.width, height: shadow.height } };
    },
    pauseTicker: () => app.ticker.stop(),
    residentPose: (id: string) => {
      const resident = scene.residents.find(member => member.cast.id === id);
      if (!resident) throw new Error("Unknown fixture resident");
      const body = resident.root.children.at(-1)!;
      const shadow = resident.root.children[0]!;
      return { rotation: body.rotation, lift: resident.lift, height: resident.height, seat: resident.seatSupport, renderedHeight: body.children[0]!.height,
        ground: { x: resident.root.x, y: resident.root.y, depth: resident.root.zIndex },
        shadow: { x: resident.root.x + shadow.x, y: resident.root.y + shadow.y, alpha: shadow.alpha } };
    },
    walkResident: (id: string, x: number, y: number) => {
      const resident = scene.residents.find(member => member.cast.id === id);
      if (!resident) throw new Error("Unknown fixture resident");
      return resident.walkTo({ x, y }, "interest", !scene.residents.some(member => member.ladderReserved), scene.residents.filter(member => member !== resident).flatMap(member => member.seatClaims));
    },
    sampleAtmosphere: (time: number) => {
      scene.ambience.update(time);
      scene.foliage.update(time);
    },
    showDust: (visible: boolean) => scene.ambience.setDustVisible(visible),
    poseResident: (id: string, x: number, y: number) => {
      const resident = scene.residents.find((member) => member.cast.id === id);
      if (!resident) throw new Error("Unknown fixture resident");
      resident.walking = false;
      Object.assign(resident.pos, { x, y });
      resident.update(0, runtime.clock, false);
      runtime.update(0);
    },
    // Local visual QA can isolate weather without altering fixture data or production code.
    inspectRain: () => {
      for (const child of scene.world.children) child.visible = child === scene.ambience.back;
      scene.ambience.inspectRain();
    },
  } });
}
