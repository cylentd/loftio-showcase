import { FIDGET_COPY } from "./lobby-copy";
import { flick, type Sample } from "./fidget-model";
import { FIDGET } from "./fidget-data";
import { FLOOR_PLAY } from "./floor-play-data";
import { STACK } from "./stack-data";
import { towerFrame } from "./stack-camera";
import { LobbyFidget } from "./lobby-fidget";
import { AutoStacker } from "./auto-stacker";
import { lobbyAutoHost } from "./auto-stack-host";
import { AUTO_STACK } from "./auto-stack-data";
import { seeded } from "./scene";
import { browserSfx } from "./sfx";
import { WORLD } from "./tune";
import type { Point } from "./resident-movement";
import type { Resident } from "./resident";
import type { ResidentPlay } from "./resident-play";
import type { RoomContext } from "./room";

/** Lobby tossing, six-resident piles and the three-high piles residents make themselves, plugged into the shared room's ResidentPlay hooks. Game-only. */
class LobbyPlay implements ResidentPlay {
  private samples: Sample[] = [];
  constructor(readonly fidget: LobbyFidget, private auto: AutoStacker, private maySelfStack: () => boolean) {}

  catch(resident: Resident, now: number): boolean { return this.fidget.catch(resident, now); }

  sample(point: Point, time: number, first: boolean): void {
    if (first) { this.samples = [{ ...point, time }]; return; }
    this.samples.push({ ...point, time });
    this.samples = this.samples.filter(sample => sample.time >= time - FIDGET.sampleMs);
  }

  carryTop(): number | undefined { return this.fidget.stacks.bounds()?.top; }

  release(resident: Resident, time: number, scale: number, moved: boolean, mayFling: boolean): string | null {
    const velocity = mayFling ? flick(this.samples, time, scale) : null;
    if (velocity) { this.fidget.throwResident(resident, velocity); return FIDGET_COPY.thrown; }
    // Stack targeting uses the visible feet before floor-placement snapping.
    if (moved && this.fidget.stacks.tryPlace(resident)) return FIDGET_COPY.stacked;
    return null;
  }

  key(resident: Resident, key: string, mayFling: boolean): string | null {
    if (key.toLowerCase() === "s") return this.fidget.stacks.tryPlace(resident, true) ? FIDGET_COPY.stacked : null;
    if (key === "Enter" && mayFling) {
      this.fidget.throwResident(resident, { x: FLOOR_PLAY.keyboardX, y: FLOOR_PLAY.keyboardY });
      return FIDGET_COPY.thrown;
    }
    return null;
  }

  reset(now: number): void { this.auto.reset(); this.fidget.reset(now); }
  update(dt: number, now: number): void {
    this.fidget.update(dt, now);
    this.auto.update(dt, now, this.maySelfStack());
  }
  snapshot() { return this.fidget.snapshot(); }
}

/** The game entry's feature: turns on lobby play, the pile-fitting camera and the help that explains them. */
export function installLobbyPlay({ scene, runtime, look, settings, audio }: RoomContext): { ready: () => void } {
  // Stacking sounds follow the room's mute and wake when the intro hands over (a user gesture has passed by then).
  const sfx = browserSfx(() => audio.playing);
  const fidget = new LobbyFidget(scene, look, sfx);
  const auto = new AutoStacker(lobbyAutoHost(scene, fidget.stacks), seeded(AUTO_STACK.seed));
  // Residents stack themselves only when they wander and motion is not paused or reduced: the gates wander and Still use.
  const play = new LobbyPlay(fidget, auto, () => settings.wander && !look.frozen);
  runtime.play = play;
  // A held resident freezes the zoom so the drop target does not slide away under the finger.
  look.reframe = (normal) => {
    const tower = play.fidget.stacks.bounds();
    const holding = !!document.querySelector('.resident-hit[data-held="true"]');
    return { frame: holding ? null : towerFrame(tower, normal.scale, innerHeight, WORLD.height), followMs: STACK.cameraFollowMs, lockY: !!tower };
  };
  const help = document.getElementById("resident-help");
  if (help) help.textContent = FIDGET_COPY.help;
  return { ready: () => sfx.unlock() };
}
