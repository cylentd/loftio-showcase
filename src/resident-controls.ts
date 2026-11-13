import { NAMES, RESIDENT_CONTROLS as COPY, SETTINGS_NAV } from "./copy";
import { controlText, settingsGroup, switchRow } from "./settings-components";
import { DragPlacement, floorPosition, worldPoint, placementPosition, surfaceAt, type Point } from "./resident-movement";
import { PLACEMENT } from "./resident-movement-data";
import type { Resident } from "./resident";
import type { Scene } from "./scene";
import type { Runtime } from "./runtime";
import type { Overlay } from "./overlay";
import type { SceneSettings } from "./scene-settings";
import { vibrate } from "./tactile";
import { NONE, next, type Grip, type GripEvent } from "./resident-grip";

/** What a grip carries along: the resident, its button and where it stood when it was taken. */
type Held = { resident: Resident; button: HTMLButtonElement; origin: Point };
type Carried = Extract<Grip<Held>, { kind: "carried" }>;

class ResidentControls {
  onDrop?: (resident: Resident) => void;
  private readonly drag = new DragPlacement();
  /** None, pressed or carried: every change goes through `next` in resident-grip.ts. */
  private grip: Grip<Held> = NONE;
  private send(event: GripEvent<Held>): Grip<Held> { return this.grip = next(this.grip, event); }
  private suppressClick: HTMLButtonElement | null = null;
  private scene: Scene;
  private runtime: Runtime;
  private overlay: Overlay;
  private settings: SceneSettings;
  constructor(scene: Scene, runtime: Runtime, overlay: Overlay, settings: SceneSettings) {
    this.scene = scene;
    this.runtime = runtime;
    this.overlay = overlay;
    this.settings = settings;
    for (const resident of scene.residents) this.bind(resident);
    addEventListener("blur", () => this.cancel());
    addEventListener("resize", () => this.cancel());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.cancel(); });
    // A second finger anywhere means a pinch or a stray palm, never a throw. Capture runs before the target sees it.
    document.addEventListener("pointerdown", (event) => { this.secondContact(event); }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.grip.kind !== "none") { event.preventDefault(); this.cancel(); }
    });
    this.menu();
  }

  forget(resident: Resident): void {
    if (this.grip.kind !== "none" && this.grip.item.resident === resident) this.cancel();
    this.runtime.play?.catch(resident, this.runtime.clock);
    resident.putDown(true, false, this.runtime.clock);
  }

  bind(resident: Resident): void {
    const button = this.overlay.residentButton(resident.cast.id);
    button.classList.add("resident-hit");
    button.setAttribute("aria-describedby", "resident-help");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("pointerdown", (event) => {
      if (this.secondContact(event)) return;
      if (event.button !== 0 || !event.isPrimary || this.grip.kind !== "none") return;
      button.dataset.input = "pointer";
      const client = { x: event.clientX, y: event.clientY };
      if (!this.drag.begin(resident.cast.id, event.pointerId, client, this.world(client), resident.pos)) return;
      resident.touch(true); this.draw(resident);
      if (event.pointerType === "touch") vibrate("touch", this.runtime.look.frozen);
      const { caught, origin } = this.take(resident);
      this.runtime.play?.sample(this.world(client), event.timeStamp, true);
      this.suppressClick = null;
      const grip = this.send({ type: "press", pointer: event.pointerId, caught, item: { resident, button, origin } });
      if (grip.kind === "carried") this.pickUp(grip);
      event.stopPropagation();
      // A pointer that is already gone throws here; nothing would ever release the grip, so end it now.
      try { button.setPointerCapture(event.pointerId); } catch { this.cancel(); }
    });
    button.addEventListener("pointermove", (event) => this.move(event));
    button.addEventListener("pointerup", (event) => this.finishPointer(event));
    button.addEventListener("pointercancel", (event) => this.finishPointer(event, true));
    button.addEventListener("lostpointercapture", (event) => this.finishPointer(event, true));
    button.addEventListener("click", (event) => {
      if (this.suppressClick !== button || event.detail === 0) return;
      this.suppressClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    button.addEventListener("keydown", (event) => { button.dataset.input = "keyboard"; this.key(event, resident, button); });
    button.addEventListener("blur", () => { delete button.dataset.input; if (this.keyGrip(button)) this.cancel(); });
  }

  /** A new contact while a pointer holds a resident cancels the hold; true when it did. */
  private secondContact(event: PointerEvent): boolean {
    const pointer = this.grip.kind === "none" ? null : this.grip.pointer;
    if (pointer === null || event.pointerId === pointer) return false;
    this.cancel();
    return true;
  }

  /** The grip, when the keyboard carries the resident behind this button. */
  private keyGrip(button: HTMLButtonElement): Carried | null {
    const grip = this.grip;
    return grip.kind === "carried" && grip.pointer === null && grip.item.button === button ? grip : null;
  }

  private catch(resident: Resident): boolean {
    return this.runtime.play?.catch(resident, this.runtime.clock) ?? false;
  }

  /** Taking a resident out of a toss or pile, or out of a fall (whose feet already stand on its landing spot), catches it mid-air. */
  private take(resident: Resident): { caught: boolean; origin: Point } {
    const falling = resident.falling;
    const caught = this.catch(resident) || falling;
    return { caught, origin: caught && !falling ? floorPosition(resident.pos) : { ...resident.pos } };
  }

  private world(point: Point): Point {
    const { look } = this.runtime;
    return worldPoint(point, { scale: look.scale, left: -look.left - look.x * look.scale + this.scene.cast.x * look.scale,
      top: look.offsetY - look.y * look.scale + this.scene.cast.y * look.scale });
  }

  private move(event: PointerEvent): void {
    if (this.grip.kind === "none" || this.grip.pointer !== event.pointerId) return;
    const { resident } = this.grip.item;
    const client = { x: event.clientX, y: event.clientY };
    const world = this.world(client);
    this.runtime.play?.sample(world, event.timeStamp, false);
    const position = this.drag.move(event.pointerId, client, world, this.runtime.look.scale, this.runtime.play?.carryTop());
    if (!position) return;
    // Play freed the resident from the hand (a topple, a landing): the hand lets go rather than taking it back.
    if (this.grip.kind === "carried" && !resident.held) { this.letGo(this.grip); return; }
    const grip = this.send({ type: "drag", pointer: event.pointerId });
    if (grip.kind === "carried" && !resident.held) this.pickUp(grip);
    resident.pull(position.x - resident.pos.x, position.y - resident.pos.y);
    Object.assign(resident.pos, position);
    this.draw(resident);
    event.preventDefault();
  }

  private finishPointer(event: PointerEvent, cancel = false): void {
    const grip = this.grip;
    if (grip.kind === "none" || grip.pointer !== event.pointerId) return;
    const held = grip.item, caught = grip.kind === "carried" && grip.caught;
    held.resident.touch(false);
    if (this.runtime.look.frozen) this.draw(held.resident);
    if (!cancel && event.pointerType === "touch") vibrate("release", this.runtime.look.frozen);
    const air = this.drag.landing;
    const result = this.drag.finish(event.pointerId, cancel);
    if (!result || !air) return;
    this.send({ type: "end" });
    if (result.moved || caught) {
      this.suppressClick = held.button;
      const { look } = this.runtime;
      const line = cancel ? null : this.runtime.play?.release(held.resident, event.timeStamp, look.scale, result.moved, !look.frozen && !look.still) ?? null;
      if (line) this.released(held, line);
      else {
        const back = caught && (cancel || !result.moved);
        const from = back ? { x: held.resident.pos.x, y: held.resident.pos.y - held.resident.lift } : air;
        Object.assign(held.resident.pos, back ? held.origin : result.position);
        this.drop(held, caught, cancel, cancel ? null : from, !back);
      }
    }
    if (held.button.hasPointerCapture(event.pointerId)) held.button.releasePointerCapture(event.pointerId);
  }

  private pickUp({ item: held, caught }: Carried): void {
    held.resident.pickUp(caught);
    held.button.dataset.held = "true";
    held.button.setAttribute("aria-pressed", "true");
    this.overlay.announce(`${held.button.getAttribute('aria-label') ?? NAMES[held.resident.cast.id]} ${COPY.picked}`);
    this.draw(held.resident);
  }

  /** Play took the resident (a toss, a pile): it is no longer held by this control. */
  private released(held: Held, line: string): void {
    delete held.button.dataset.held;
    held.button.setAttribute("aria-pressed", "false");
    this.overlay.announce(`${held.button.getAttribute('aria-label') ?? NAMES[held.resident.cast.id]} ${line}`);
    this.runtime.update(0);
  }

  /** `from`: where it was let go, when that was over thin air and its feet now stand on the surface below. */
  private drop(held: Held, caught: boolean, cancel: boolean, from: Point | null = null, carried = true): void {
    const resident = held.resident;
    if (!cancel) {
      const line = this.runtime.play?.place?.(resident, carried ? from : null);
      if (line) { this.released(held, line); return; }
    }
    if ((!cancel || caught) && !from) Object.assign(resident.pos, placementPosition(resident.pos));
    resident.putDown(!cancel || caught, !this.runtime.look.frozen, this.runtime.clock);
    if (from && !this.runtime.look.frozen) resident.fall(from, carried);
    delete held.button.dataset.held;
    held.button.setAttribute("aria-pressed", "false");
    this.overlay.announce(`${held.button.getAttribute('aria-label') ?? NAMES[resident.cast.id]} ${cancel ? COPY.cancelled : COPY.placed}`);
    const interest = resident.cast.interest;
    if (!cancel && !resident.falling && Math.hypot(resident.pos.x - interest.x, resident.pos.y - interest.y) <= PLACEMENT.interestRadius) {
      this.overlay.arrive(resident.cast.id);
    }
    this.draw(resident);
    if (!cancel) this.onDrop?.(resident);
  }

  private draw(resident: Resident): void {
    resident.update(0, this.runtime.clock, this.runtime.look.frozen);
    this.runtime.update(0);
  }

  private key(event: KeyboardEvent, resident: Resident, button: HTMLButtonElement): void {
    if (event.key === " ") {
      event.preventDefault();
      if (event.repeat) return;
      const carried = this.keyGrip(button);
      if (this.grip.kind === "none") {
        const { caught, origin } = this.take(resident);
        const grip = this.send({ type: "key", caught, item: { resident, button, origin } });
        if (grip.kind === "carried") this.pickUp(grip);
      } else if (carried) {
        this.send({ type: "end" }); this.drop(carried.item, carried.caught, false);
      }
      return;
    }
    const carried = this.keyGrip(button);
    if (!carried) return;
    const { look } = this.runtime;
    const line = this.runtime.play?.key(resident, event.key, !look.frozen && !look.still) ?? null;
    if (line) {
      event.preventDefault();
      this.send({ type: "end" }); this.released(carried.item, line);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      Object.assign(resident.pos, placementPosition({ x: resident.pos.x, y: event.key === "PageUp" ? PLACEMENT.loftKeyY : PLACEMENT.groundKeyY }));
      this.draw(resident);
      return;
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? PLACEMENT.fineStep : PLACEMENT.keyStep;
    Object.assign(resident.pos, floorPosition({ x: resident.pos.x + direction[0]! * step, y: resident.pos.y + direction[1]! * step }, surfaceAt(resident.pos)));
    this.draw(resident);
  }

  private cancel(): void {
    const grip = this.grip;
    if (grip.kind === "none") return;
    const held = grip.item;
    held.resident.touch(false);
    if (this.runtime.look.frozen) this.draw(held.resident);
    this.send({ type: "end" });
    if (grip.pointer !== null) {
      this.drag.finish(grip.pointer, true);
      if (held.button.hasPointerCapture(grip.pointer)) held.button.releasePointerCapture(grip.pointer);
    }
    if (!held.resident.held) return;
    this.suppressClick = held.button;
    Object.assign(held.resident.pos, held.origin);
    this.drop(held, grip.kind === "carried" && grip.caught, true);
  }

  /** Ends a pointer grip on a resident that something else already put down: no drop, no announcement. */
  private letGo(grip: Carried): void {
    const { button, resident } = grip.item;
    resident.touch(false);
    this.send({ type: "end" });
    if (grip.pointer !== null) {
      this.drag.finish(grip.pointer, true);
      if (button.hasPointerCapture(grip.pointer)) button.releasePointerCapture(grip.pointer);
    }
    this.suppressClick = button;
    delete button.dataset.held;
    button.setAttribute("aria-pressed", "false");
  }

  private menu(): void {
    const wander = document.createElement("label"); wander.className = "cue-control";
    const toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = this.settings.wander;
    toggle.id = "settings-wander";
    toggle.addEventListener("change", () => this.settings.setWander(toggle.checked));
    this.settings.subscribe(() => { toggle.checked = this.settings.wander; });
    switchRow(wander, toggle, COPY.wander, COPY.wanderHelp, "wander");
    const details = document.createElement("details");
    details.className = "scene-residents";
    const summary = document.createElement("summary");
    summary.textContent = SETTINGS_NAV.details;
    const panel = document.createElement("div");
    panel.className = "resident-panel";
    const help = document.createElement("p");
    help.id = "resident-help"; help.textContent = COPY.help;
    const reset = document.createElement("button"); reset.className = "world-button";
    controlText(reset, "reset", COPY.reset);
    reset.addEventListener("click", () => {
      this.cancel();
      this.runtime.play?.reset(this.runtime.clock);
      for (const resident of this.scene.residents) { resident.resetHome(); this.draw(resident); }
      this.overlay.announce(COPY.restored);
    });
    panel.append(help); details.append(summary, panel);
    const group = settingsGroup("resident-settings", SETTINGS_NAV.residents, "residents");
    group.append(wander);
    const actions = document.createElement("div"); actions.className = "room-resident-actions";
    actions.append(details, reset);
    group.append(actions);
  }
}

export function installResidentControls(scene: Scene, runtime: Runtime, overlay: Overlay, settings: SceneSettings) {
  return new ResidentControls(scene, runtime, overlay, settings);
}
