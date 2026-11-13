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
import { activeRoom } from "./room-layout";
import { PORTRAIT_MESSAGE_SPOT } from "./portrait-movement-data";
import type { ResidentPlay } from "./resident-play";
import { stepPersonalSpace } from "./personal-space-room";

const TAP_MIN = 44;
const HIT_WIDTH = 0.78;
const HIT_HEIGHT = 0.95;
const CUE_HIT_SCALE = 1.3;
const BUBBLE_CUE = 0.6;

export class Runtime {
  clock = 0;
  private nextWalk = ROUTINE.firstWalkMs;
  private messageTrip = false;
  private readonly rand = seeded(ROUTINE.seed);
  /** Extra resident play a game entry installed, or null (the showcase). */
  play: ResidentPlay | null = null;
  private scene: Scene;
  readonly look: Look;
  private overlay: Overlay;
  private busy: boolean;
  private settings: SceneSettings;
  constructor(scene: Scene, look: Look, overlay: Overlay, busy: boolean, settings: SceneSettings) {
    this.scene = scene;
    this.look = look;
    this.overlay = overlay;
    this.busy = busy;
    this.settings = settings;
  }

  syncWander(): void {
    if (this.settings.wander) {
      for (const resident of this.scene.residents) resident.resumeWalking();
      return;
    }
    for (const resident of this.scene.residents) {
      if (!resident.walking || resident.held || this.messageTrip && this.foregroundCarrier(resident.cast.id)) continue;
      resident.stopWalking();
      resident.update(0, this.clock, true);
    }
    this.place();
  }

  update(delta: number, render = true): void {
    const { world, cast, residents, ambience, foliage, letter, puff, lighting } = this.scene;
    letter.visible = this.settings.showCue && residents.includes(puff);
    this.overlay.setCueVisible(letter.visible);
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
    if (dt) this.routine(dt);
    for (const r of residents) {
      if (!dt && !(this.look.frozen && (r.held || r.falling))) continue;
      const arriving = r.walking && r.at === "interest";
      const falling = r.falling;
      r.update(dt, this.clock, this.look.frozen);
      if (falling && !r.falling && Math.hypot(r.pos.x - r.cast.interest.x, r.pos.y - r.cast.interest.y) <= PLACEMENT.interestRadius) this.overlay.arrive(r.cast.id);
      if (arriving && !r.walking) {
        r.play("nod");
        const favorite = Math.hypot(r.pos.x - r.cast.interest.x, r.pos.y - r.cast.interest.y) <= PLACEMENT.interestRadius;
        if (favorite || isLoft(r.pos)) this.overlay.arrive(r.cast.id, isLoft(r.pos));
      }
    }
    this.play?.update(dt, this.clock);
    stepPersonalSpace(residents, dt);
    ambience.update(this.clock, lighting.timeline.blend, lighting.flickers);
    foliage.update(this.clock);
    letter.position.set(puff.pos.x + cast.x, puff.pos.y + cast.y - puff.lift - puff.height * (1 + CUE.lift)
      + Math.sin(this.clock / CUE.bobMs * Math.PI * 2) * CUE.bob);
    letter.rotation = Math.sin(this.clock / CUE.bobMs * Math.PI) * CUE.sway;
    this.place();
  }

  private foregroundCarrier(id: string): boolean {
    return activeRoom === "portrait" && this.settings.showCue && id === this.scene.puff.cast.id;
  }

  private approachMessage(): boolean {
    const { residents, puff } = this.scene;
    if (!residents.includes(puff) || !this.foregroundCarrier(puff.cast.id) || puff.held) { this.messageTrip = false; return false; }
    if (puff.walking && (this.messageTrip || puff.climbing)) return false;
    if (!puff.walking && Math.hypot(puff.pos.x - PORTRAIT_MESSAGE_SPOT.x, puff.pos.y - PORTRAIT_MESSAGE_SPOT.y) <= 2) { this.messageTrip = false; return false; }
    if (!puff.walking && residents.filter(resident => resident.walking).length >= ROUTINE.maxMoving) return false;
    this.messageTrip = puff.walkTo(PORTRAIT_MESSAGE_SPOT, "home", !residents.some(resident => resident.ladderReserved), residents.filter(resident => resident !== puff).flatMap(resident => resident.seatClaims));
    return this.messageTrip;
  }

  private routine(dt: number): void {
    if (this.approachMessage() || !this.settings.wander) return;
    this.nextWalk -= dt;
    const { residents } = this.scene;
    if (residents.filter((r) => r.walking).length >= ROUTINE.maxMoving) return;
    const resuming = residents.find((r) => r.wanderAfter > 0 && canWander(this.settings.wander, r.held, r.walking, this.clock, r.wanderAfter, this.foregroundCarrier(r.cast.id)));
    if (!resuming && this.nextWalk > 0) return;
    const idle = residents.filter((r) => canWander(this.settings.wander, r.held, r.walking, this.clock, r.wanderAfter, this.foregroundCarrier(r.cast.id)));
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
      if (!r || r.held || r.falling) return null;
      const lift = id === "puff" && this.settings.showCue ? r.height * (1 + CUE.lift) + CUE.size * BUBBLE_CUE : r.height * HIT_HEIGHT;
      return { x: (r.pos.x + cast.x - x) * scale, y: (r.pos.y + cast.y - y - r.lift - lift) * scale + offsetY, height: r.height * scale };
    });
  }
}
