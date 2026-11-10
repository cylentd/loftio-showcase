import { NAMES, RESIDENT_CONTROLS as COPY, SETTINGS_NAV } from "./copy";
import { controlText, settingsGroup, switchRow } from "./settings-components";
import { DragPlacement, floorPosition, worldPoint, placementPosition, surfaceAt, type Point } from "./resident-movement";
import { PLACEMENT } from "./resident-movement-data";
import type { Resident } from "./resident";
import type { Scene } from "./scene";
import type { Runtime } from "./runtime";
import type { Overlay } from "./overlay";
import type { SceneSettings } from "./scene-settings";

/** `caught`: taken back out of a game feature's play (runtime.play), so it is held from the first touch. */
type Held = { resident: Resident; button: HTMLButtonElement; origin: Point; pointer: number | null; caught?: boolean };

class ResidentControls {
  onDrop?: (resident: Resident) => void;
  private readonly drag = new DragPlacement();
  private held: Held | null = null;
  private suppressClick: HTMLButtonElement | null = null;
  constructor(private scene: Scene, private runtime: Runtime, private overlay: Overlay, private settings: SceneSettings) {
    for (const resident of scene.residents) this.bind(resident);
    addEventListener("blur", () => this.cancel());
    addEventListener("resize", () => this.cancel());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.cancel(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.held) { event.preventDefault(); this.cancel(); }
    });
    this.menu();
  }

  forget(resident: Resident): void {
    if (this.held?.resident === resident) this.cancel();
    this.runtime.play?.catch(resident, this.runtime.clock);
    resident.putDown(true, false, this.runtime.clock);
  }

  bind(resident: Resident): void {
    const button = this.overlay.residentButton(resident.cast.id);
    button.classList.add("resident-hit");
    button.setAttribute("aria-describedby", "resident-help");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || this.held) return;
      button.dataset.input = "pointer";
      const client = { x: event.clientX, y: event.clientY };
      if (!this.drag.begin(resident.cast.id, event.pointerId, client, this.world(client), resident.pos)) return;
      const caught = this.catch(resident);
      this.runtime.play?.sample(this.world(client), event.timeStamp, true);
      this.suppressClick = null;
      this.held = { resident, button, origin: caught ? floorPosition(resident.pos) : { ...resident.pos }, pointer: event.pointerId, caught };
      if (caught) this.pickUp(this.held);
      button.setPointerCapture(event.pointerId);
      event.stopPropagation();
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
    button.addEventListener("blur", () => { delete button.dataset.input; if (this.held?.pointer === null && this.held.button === button) this.cancel(); });
  }

  private catch(resident: Resident): boolean {
    return this.runtime.play?.catch(resident, this.runtime.clock) ?? false;
  }

  private world(point: Point): Point {
    const { look } = this.runtime;
    return worldPoint(point, { scale: look.scale, left: -look.left - look.x * look.scale + this.scene.cast.x * look.scale,
      top: look.offsetY - look.y * look.scale + this.scene.cast.y * look.scale });
  }

  private move(event: PointerEvent): void {
    const held = this.held;
    if (!held || held.pointer !== event.pointerId) return;
    const client = { x: event.clientX, y: event.clientY };
    const world = this.world(client);
    this.runtime.play?.sample(world, event.timeStamp, false);
    const position = this.drag.move(event.pointerId, client, world, this.runtime.look.scale, this.runtime.play?.carryTop());
    if (!position) return;
    if (!held.resident.held) this.pickUp(held);
    held.resident.pull(position.x - held.resident.pos.x, position.y - held.resident.pos.y);
    Object.assign(held.resident.pos, position);
    this.draw(held.resident);
    event.preventDefault();
  }

  private finishPointer(event: PointerEvent, cancel = false): void {
    const held = this.held;
    if (!held || held.pointer !== event.pointerId) return;
    const result = this.drag.finish(event.pointerId, cancel);
    if (!result) return;
    this.held = null;
    if (result.moved || held.caught) {
      this.suppressClick = held.button;
      const { look } = this.runtime;
      const line = cancel ? null : this.runtime.play?.release(held.resident, event.timeStamp, look.scale, result.moved, !look.frozen && !look.still) ?? null;
      if (line) this.released(held, line);
      else {
        Object.assign(held.resident.pos, held.caught && (cancel || !result.moved) ? held.origin : result.position);
        this.drop(held, cancel);
      }
    }
    if (held.button.hasPointerCapture(event.pointerId)) held.button.releasePointerCapture(event.pointerId);
  }

  private pickUp(held: Held): void {
    held.resident.pickUp(held.caught);
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

  private drop(held: Held, cancel: boolean): void {
    const resident = held.resident;
    resident.putDown(!cancel || !!held.caught, !this.runtime.look.frozen, this.runtime.clock);
    delete held.button.dataset.held;
    held.button.setAttribute("aria-pressed", "false");
    this.overlay.announce(`${held.button.getAttribute('aria-label') ?? NAMES[resident.cast.id]} ${cancel ? COPY.cancelled : COPY.placed}`);
    const interest = resident.cast.interest;
    if (!cancel && Math.hypot(resident.pos.x - interest.x, resident.pos.y - interest.y) <= PLACEMENT.interestRadius) {
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
      if (!this.held) {
        const caught = this.catch(resident);
        this.held = { resident, button, origin: caught ? floorPosition(resident.pos) : { ...resident.pos }, pointer: null, caught };
        this.pickUp(this.held);
      } else if (this.held.button === button && this.held.pointer === null) {
        const held = this.held; this.held = null; this.drop(held, false);
      }
      return;
    }
    if (this.held?.button !== button || this.held.pointer !== null) return;
    const { look } = this.runtime;
    const line = this.runtime.play?.key(resident, event.key, !look.frozen && !look.still) ?? null;
    if (line) {
      event.preventDefault();
      const held = this.held; this.held = null; this.released(held, line);
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
    const held = this.held;
    if (!held) return;
    this.held = null;
    if (held.pointer !== null) {
      this.drag.finish(held.pointer, true);
      if (held.button.hasPointerCapture(held.pointer)) held.button.releasePointerCapture(held.pointer);
    }
    if (!held.resident.held) return;
    this.suppressClick = held.button;
    Object.assign(held.resident.pos, held.origin);
    this.drop(held, true);
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
