import { LOOK } from "./copy";
import { mountControls } from "./controls";
import { controlText } from "./settings-components";
import { EFFECTS } from "./effects-constants";
import { cameraOffset } from "./effects-model";
import { WORLD } from "./tune";
import { activeRoom, roomFrame } from "./room-layout";

const PHONE_MAX = 600;
export type CameraFrame = { scale: number; offsetY: number };
/** A game feature's camera request, read every frame. `frame` null keeps the current zoom (e.g. while holding);
 *  `lockY` holds the vertical look still. With no reframe set, Look keeps the room's normal layout. */
export type Reframe = (normal: CameraFrame) => { frame: CameraFrame | null; followMs: number; lockY: boolean };

export class Look {
  reframe: Reframe | null = null;
  private baseScale = 1;
  private baseOffsetY = 0;
  private inset = 0;
  private lockY = false;
  scale = 1;
  offsetY = 0;
  x = 0;
  y = 0;
  still = new URLSearchParams(location.search).has("still");
  readonly reduced = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly forcedReduced = new URLSearchParams(location.search).has("reduced");
  private target = { x: 0, y: 0 };
  private drag: { x: number; y: number; targetX: number; targetY: number; left: number } | null = null;
  private readonly motionButton = document.createElement("button");
  private readonly lookButton = document.createElement("button");

  constructor(private scroller: HTMLElement, private worldEl: HTMLElement, private focusX: number) {
    this.controls();
    this.layout();
    addEventListener("resize", () => this.layout());
    scroller.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button") || (this.frozen && activeRoom !== "portrait")) return;
      this.drag = { x: e.clientX, y: e.clientY, targetX: this.target.x, targetY: this.target.y, left: scroller.scrollLeft };
      scroller.setPointerCapture(e.pointerId);
      scroller.classList.add("looking");
    });
    scroller.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      if (activeRoom === "portrait") {
        scroller.scrollLeft = this.drag.left + this.drag.x - e.clientX;
        return;
      }
      if (this.frozen) return;
      this.target = {
        x: Math.max(-1, Math.min(1, this.drag.targetX + (this.drag.x - e.clientX) / EFFECTS.dragDistance)),
        y: Math.max(-1, Math.min(1, this.drag.targetY + (this.drag.y - e.clientY) / EFFECTS.dragDistance)),
      };
    });
    const release = () => {
      this.drag = null;
      scroller.classList.remove("looking");
    };
    scroller.addEventListener("pointerup", release);
    scroller.addEventListener("pointercancel", release);
    this.reduced.addEventListener("change", () => this.sync());
    this.sync();
  }

  get frozen(): boolean {
    return this.still || this.reduced.matches || this.forcedReduced;
  }

  private controls(): void {
    const toolbar = document.createElement("div");
    toolbar.className = "scene-controls world-frame";
    const look = this.lookButton;
    controlText(look, "look", innerWidth <= PHONE_MAX ? LOOK.swipe : LOOK.drag);
    look.setAttribute("aria-label", LOOK.keyboard);
    look.title = LOOK.help;
    look.addEventListener("keydown", (e) => {
      const axis = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], Home: [0, 0] }[e.key];
      if (axis && activeRoom === "portrait") {
        e.preventDefault();
        this.scroller.scrollLeft = e.key === "Home" ? this.focusX * this.scale - innerWidth / 2 : this.scroller.scrollLeft + axis[0]! * innerWidth / 2;
        return;
      }
      if (!axis || this.frozen) return;
      e.preventDefault();
      this.target = e.key === "Home" ? { x: 0, y: 0 } : {
        x: axis[0] || this.target.x, y: axis[1] || this.target.y,
      };
    });
    look.addEventListener("click", () => {
      this.target = { x: 0, y: 0 };
      if (activeRoom === "portrait") this.scroller.scrollLeft = this.focusX * this.scale - innerWidth / 2;
    });
    controlText(this.motionButton, "pause", LOOK.still);
    this.motionButton.addEventListener("click", () => { this.still = !this.still; this.sync(); });
    toolbar.append(look, this.motionButton);
    mountControls(toolbar);
  }

  private sync(): void {
    this.motionButton.setAttribute("aria-pressed", String(this.frozen));
    this.motionButton.disabled = this.reduced.matches || this.forcedReduced;
    this.motionButton.title = this.reduced.matches ? LOOK.reduced : LOOK.stillHelp;
  }

  private layout(): void {
    controlText(this.lookButton, "look", innerWidth <= PHONE_MAX ? LOOK.swipe : LOOK.drag);
    const frame = roomFrame(innerWidth, innerHeight, WORLD, activeRoom === "portrait" ? 1 : EFFECTS.overscan);
    this.scale = this.baseScale = frame.scale;
    this.offsetY = this.baseOffsetY = frame.offsetY;
    this.inset = 0;
    this.worldEl.style.marginLeft = "0px";
    this.worldEl.style.width = `${WORLD.width * this.scale}px`;
    this.worldEl.style.height = `${innerHeight}px`;
    this.scroller.scrollLeft = activeRoom === "portrait"
      ? this.focusX * this.scale - innerWidth / 2 : (WORLD.width * this.scale - innerWidth) / 2;
  }

  refresh(focusX: number): void {
    this.focusX = focusX;
    this.x = this.y = 0;
    this.target = { x: 0, y: 0 };
    this.layout();
  }

  /** Eases toward the frame a feature asked for, keeping the view centred; a narrower world sits inset. */
  private applyReframe(dt: number): void {
    if (!this.reframe) { this.lockY = false; return; }
    const request = this.reframe({ scale: this.baseScale, offsetY: this.baseOffsetY });
    this.lockY = request.lockY;
    if (!request.frame) return;
    const follow = this.frozen ? 1 : 1 - Math.exp(-dt / request.followMs);
    const center = (this.left + innerWidth / 2) / this.scale;
    this.scale += (request.frame.scale - this.scale) * follow;
    this.offsetY += (request.frame.offsetY - this.offsetY) * follow;
    const width = WORLD.width * this.scale;
    this.inset = Math.max(0, (innerWidth - width) / 2);
    this.worldEl.style.width = `${width}px`;
    this.worldEl.style.marginLeft = `${this.inset}px`;
    this.scroller.scrollLeft = center * this.scale + this.inset - innerWidth / 2;
  }

  update(dt: number): void {
    // matches can update before the browser dispatches the media-query change event.
    if (this.motionButton.disabled !== (this.reduced.matches || this.forcedReduced)
      || this.motionButton.getAttribute("aria-pressed") !== String(this.frozen)) this.sync();
    this.applyReframe(dt);
    if (dt) {
      const target = cameraOffset(this.target, innerWidth, innerHeight, this.scale);
      if (this.lockY) target.y = 0;
      const follow = 1 - Math.exp(-dt / EFFECTS.followMs);
      this.x += (target.x - this.x) * follow;
      this.y += (target.y - this.y) * follow;
    }
    const left = this.scroller.scrollLeft / this.scale;
    this.x = WORLD.width * this.scale < innerWidth ? 0 : Math.max(-left, Math.min(WORLD.width - innerWidth / this.scale - left, this.x));
  }

  get left(): number { return this.scroller.scrollLeft - this.inset; }
}
