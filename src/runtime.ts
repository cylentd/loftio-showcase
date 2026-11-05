import { EFFECTS } from "./effects-constants";
import { motionStep } from "./effects-model";
import type { Look } from "./look";
import type { Overlay } from "./overlay";
import { seeded, type Scene } from "./scene";
import { CUE, ROUTINE } from "./tune";
import type { SceneSettings } from "./scene-settings";
import { canWander, wanderTarget } from "./wander-model";
import { isLoft } from "./resident-movement";
import { PLACEMENT } from "./resident-movement-data";

const TAP_MIN = 44;
const HIT_WIDTH = 0.78;
const HIT_HEIGHT = 0.95;
const CUE_HIT_SCALE = 1.3;
const BUBBLE_CUE = 0.6;

export class Runtime {
  clock = 0;
  private nextWalk = ROUTINE.firstWalkMs;
  private readonly rand = seeded(ROUTINE.seed);
  constructor(private scene: Scene, readonly look: Look, private overlay: Overlay, private busy: boolean, private settings: SceneSettings) {}

  syncWander(): void {
    if (this.settings.wander) {
      for (const resident of this.scene.residents) resident.resumeWalking();
      return;
    }
    for (const resident of this.scene.residents) {
      if (!resident.walking || resident.held) continue;
      resident.stopWalking();
      resident.update(0, this.clock, true);
    }
    this.place();
  }

  update(delta: number, render = true): void {
    const { world, cast, residents, ambience, foliage, letter, puff, lighting } = this.scene;
    const dt = motionStep(delta, { still: this.look.still, reduced: this.look.frozen, hidden: document.hidden, scene: true });
    this.clock += dt;
    lighting.update(dt, this.settings.lighting, this.look.frozen, this.clock, render);
    this.settings.updateLightingBlend(lighting.timeline.blend);
    for (const resident of residents) resident.setLighting(lighting.timeline.blend);
    this.look.update(dt);
    const { scale, x, y, offsetY, left } = this.look;
    world.scale.set(scale);
    world.position.set(-left - x * scale, offsetY - y * scale);
    cast.position.set(-x * EFFECTS.castParallax, -y * EFFECTS.castParallax);
    for (const prop of this.scene.props) prop.position.set(-cast.x, -cast.y);
    if (dt) {
      this.routine(dt);
      for (const r of residents) {
        const arriving = r.walking && r.at === "interest";
        r.update(dt, this.clock, false);
        if (arriving && !r.walking) {
          r.play("nod");
          const favorite = Math.hypot(r.pos.x - r.cast.interest.x, r.pos.y - r.cast.interest.y) <= PLACEMENT.interestRadius;
          if (favorite || isLoft(r.pos)) this.overlay.arrive(r.cast.id, isLoft(r.pos));
        }
      }
    }
    if (!dt && this.look.frozen) for (const resident of residents) if (resident.held) resident.update(0, this.clock, true);
    ambience.update(this.clock, lighting.timeline.blend, lighting.flickers);
    foliage.update(this.clock);
    letter.position.set(puff.pos.x + cast.x, puff.pos.y + cast.y - puff.lift - puff.height * (1 + CUE.lift)
      + Math.sin(this.clock / CUE.bobMs * Math.PI * 2) * CUE.bob);
    letter.rotation = Math.sin(this.clock / CUE.bobMs * Math.PI) * CUE.sway;
    this.place();
  }

  private routine(dt: number): void {
    if (!this.settings.wander) return;
    this.nextWalk -= dt;
    const { residents } = this.scene;
    if (residents.filter((r) => r.walking).length >= ROUTINE.maxMoving) return;
    const resuming = residents.find((r) => r.wanderAfter > 0 && canWander(this.settings.wander, r.held, r.walking, this.clock, r.wanderAfter));
    if (!resuming && this.nextWalk > 0) return;
    const idle = residents.filter((r) => canWander(this.settings.wander, r.held, r.walking, this.clock, r.wanderAfter));
    const who = resuming ?? idle[Math.floor(this.rand() * idle.length)];
    if (who) {
      who.wanderAfter = 0;
      who.walkTo(wanderTarget(who.home, who.cast.interest, who.at, this.rand(), true), who.at === "home" ? "interest" : "home",
        !residents.some(resident => resident.ladderReserved), residents.filter(resident => resident !== who).flatMap(resident => resident.seatClaims));
    }
    const min = this.busy ? ROUTINE.busyMinGapMs : ROUTINE.minGapMs;
    const max = this.busy ? ROUTINE.busyMaxGapMs : ROUTINE.maxGapMs;
    this.nextWalk = min + this.rand() * (max - min);
  }

  private place(): void {
    const { residents, cast, letter } = this.scene;
    const { scale, x, y, offsetY } = this.look;
    for (const r of residents) {
      const w = Math.max(TAP_MIN, r.height * r.aspect * HIT_WIDTH * scale);
      const h = Math.max(TAP_MIN, r.height * HIT_HEIGHT * scale);
      this.overlay.place(r.cast.id, {
        x: (r.pos.x + cast.x - x) * scale - w / 2,
        y: (r.pos.y + cast.y - y - r.lift) * scale + offsetY - h, w, h,
      });
      this.overlay.residentButton(r.cast.id).style.zIndex = String(Math.round(r.root.zIndex));
    }
    const size = Math.max(TAP_MIN, CUE.size * CUE_HIT_SCALE * scale);
    this.overlay.place("cue", { x: (letter.x - x) * scale - size / 2, y: (letter.y - y) * scale + offsetY - size / 2, w: size, h: size });
    this.overlay.placeBubble((id) => {
      const r = residents.find((resident) => resident.cast.id === id);
      if (!r) return null;
      const lift = id === "puff" && this.settings.showCue ? r.height * (1 + CUE.lift) + CUE.size * BUBBLE_CUE : r.height * HIT_HEIGHT;
      return { x: (r.pos.x + cast.x - x) * scale, y: (r.pos.y + cast.y - y - r.lift - lift) * scale + offsetY };
    });
  }
}
