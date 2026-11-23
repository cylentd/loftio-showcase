// Pointer-driven tilt for one holographic card: the pointer sets a target, a spring follows it, and every frame
// writes the CSS custom properties the foil, glare and tilt read. Reduced motion writes one static sheen and stops.
// Holo integrated (2026-11-20): the foil and glare are gradients moved by those properties (holo-card.css,
// holo-types.css), so light moves inside the card at each layer's own rate, the way it does on a printed foil. The
// idle animation feeds the same spring targets as the pointer, so it is the tilt motion, never a separate layer.
import { HOLO_ALIVE, HOLO_IDLE, HOLO_MAX_STEP, HOLO_SETTLE, HOLO_STATIC_SHEEN, HOLO_TUNE } from './constants';
import { depthOffset } from './holo-alive-model';
import { foilOffset, holoVars, idlePoint, pointerPercent, springStep, type Spring } from './holo-card-model';

const MS_PER_SECOND = 1000;
const CENTRE = 50;
/** Decimal places written to the custom properties: finer than a pixel on the big card, and fewer style changes. */
const DIGITS = 3;
/** The depth offset is a share of the card's width (about 0.015 at most): 5 places is under a tenth of a pixel. */
const DEPTH_DIGITS = 5;
type Key = 'px' | 'py' | 'active';

/** Foil and glare opacity for a frame: the rest share shows at rest, the rest of it grows with tilt. */
function opacities(active: number, from: number): { shine: number; glare: number } {
  const lift = HOLO_TUNE.restShine + (1 - HOLO_TUNE.restShine) * Math.max(active * HOLO_TUNE.restShine, from);
  return { shine: HOLO_TUNE.shineStrength * lift, glare: HOLO_TUNE.glareStrength * lift };
}

export class HoloTilt {
  private readonly hit: HTMLElement;
  private readonly face: HTMLElement;
  private readonly springs: Record<Key, Spring>;
  private readonly target: Record<Key, number>;
  private frame: number;
  private last: number;
  private readonly off: AbortController;
  private readonly reduced: boolean;
  private suspended: boolean;
  /** The idle animation is on (the board's toggle), and whether the pointer leads right now. */
  private idle: boolean;
  private held: boolean;
  private readonly born: number;
  /** The foil and glare layers: the only elements that read the properties, so only they restyle each frame. Set on
   *  the tilt layer instead, every frame restyled the whole card (words, icons, resident): 1 s of style work in a
   *  2 s trace at 4x CPU throttle (holo integrated, 2026-11-20). */
  private readonly layers: HTMLElement[];
  /** The opened card's painting and motes (holo-alive.ts): they take the clamped depth offset, nothing else. */
  private readonly depthLayers: HTMLElement[];

  /** `hit` is measured for the pointer and is never transformed; `face` carries the tilt, its foil and glare layers
   *  the properties. */
  constructor(hit: HTMLElement, face: HTMLElement, reduced: boolean) {
    this.hit = hit;
    this.face = face;
    this.layers = [...face.querySelectorAll<HTMLElement>('.holo-foil, .holo-glare')];
    this.depthLayers = [];
    this.reduced = reduced;
    this.suspended = false;
    this.idle = false;
    this.held = false;
    this.born = performance.now();
    this.springs = { px: { value: CENTRE, velocity: 0 }, py: { value: CENTRE, velocity: 0 }, active: { value: 0, velocity: 0 } };
    this.target = { px: CENTRE, py: CENTRE, active: 0 };
    this.frame = 0;
    this.last = 0;
    this.off = new AbortController();
    if (reduced) {
      this.write(HOLO_STATIC_SHEEN.px, HOLO_STATIC_SHEEN.py, 0);
      return;
    }
    this.write(CENTRE, CENTRE, 0);
    const signal = this.off.signal;
    const aim = (event: PointerEvent) => this.aim(event.clientX, event.clientY);
    hit.addEventListener('pointermove', aim, { signal });
    hit.addEventListener('pointerdown', aim, { signal });
    hit.addEventListener('pointerleave', () => this.rest(), { signal });
    hit.addEventListener('pointercancel', () => this.rest(), { signal });
    hit.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') this.rest(); }, { signal });
  }

  /**
   * Holds the card flat and ignores the pointer, while a flight or flip owns the card's motion, so the two never
   * fight. The foil keeps its rest sheen. `resume` lets the pointer and the idle animation back in.
   */
  suspend(): void {
    this.suspended = true;
    this.held = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const key of ['px', 'py', 'active'] as const) this.springs[key] = { value: key === 'active' ? 0 : CENTRE, velocity: 0 };
    Object.assign(this.target, { px: CENTRE, py: CENTRE, active: 0 });
    if (!this.reduced) this.write(CENTRE, CENTRE, 0);
  }

  resume(): void {
    this.suspended = false;
    if (this.idle) this.kick();
  }

  /** Turns the idle animation on or off. Reduced motion keeps it off. Off eases the card back flat. */
  setIdle(on: boolean): void {
    if (this.reduced || this.idle === on) return;
    this.idle = on;
    if (!on && !this.held) Object.assign(this.target, { px: CENTRE, py: CENTRE, active: 0 });
    if (!this.suspended) this.kick();
  }

  /** Points the card at a client-space position, fully engaged. The pointer leads over the idle path. */
  aim(x: number, y: number): void {
    if (this.suspended) return;
    const { px, py } = pointerPercent(x, y, this.hit.getBoundingClientRect());
    this.held = true;
    Object.assign(this.target, { px, py, active: 1 });
    this.kick();
  }

  /** The pointer lets go: the card eases back flat, or onto the idle path when the animation is on. */
  rest(): void {
    if (this.suspended) return;
    this.held = false;
    this.target.active = 0;
    this.kick();
  }

  /** Layers that shift against the tilt, as if set deeper (depth on tilt, look test #565). */
  addDepthLayers(layers: HTMLElement[]): void {
    this.depthLayers.push(...layers);
  }

  dispose(): void {
    this.off.abort();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private kick(): void {
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(now => this.step(now));
  }

  private step(now: number): void {
    const dt = Math.min(HOLO_MAX_STEP, (now - this.last) / MS_PER_SECOND);
    this.last = now;
    const idling = this.idle && !this.held;
    if (idling) Object.assign(this.target, idlePoint((now - this.born) / MS_PER_SECOND, HOLO_IDLE));
    let settled = !idling; // the idle path never settles: it runs until the pointer leads or the toggle turns it off
    for (const key of ['px', 'py', 'active'] as const) {
      const next = springStep(this.springs[key], this.target[key], HOLO_TUNE.stiffness, HOLO_TUNE.damping, dt);
      this.springs[key] = next;
      // px and py are percent, active is 0 to 1: scale the settle test to each.
      const unit = key === 'active' ? 1 : CENTRE * 2;
      if (Math.abs(next.value - this.target[key]) > HOLO_SETTLE * unit || Math.abs(next.velocity) > HOLO_SETTLE * unit) settled = false;
    }
    this.write(this.springs.px.value, this.springs.py.value, this.springs.active.value);
    this.frame = settled ? 0 : requestAnimationFrame(next => this.step(next));
  }

  /** One frame: the tilt as an inline transform, everything the foil and glare paint from as custom properties. */
  private write(px: number, py: number, active: number): void {
    const vars = holoVars(px, py, active, HOLO_TUNE);
    const { mx, my } = foilOffset(vars, HOLO_TUNE);
    const { shine, glare } = opacities(active, vars.from);
    this.face.style.transform = `rotateX(${vars.rx.toFixed(DIGITS)}deg) rotateY(${vars.ry.toFixed(DIGITS)}deg)`;
    const values: [string, string][] = [
      ['--holo-px', `${vars.px.toFixed(DIGITS)}%`], ['--holo-py', `${vars.py.toFixed(DIGITS)}%`],
      ['--holo-mx', mx.toFixed(DIGITS)], ['--holo-my', my.toFixed(DIGITS)], ['--holo-from', vars.from.toFixed(DIGITS)],
      ['--holo-shine', shine.toFixed(DIGITS)], ['--holo-glare', glare.toFixed(DIGITS)],
    ];
    for (const layer of this.layers) for (const [name, value] of values) layer.style.setProperty(name, value);
    if (!this.depthLayers.length) return;
    const depth = depthOffset(px, py, active, HOLO_ALIVE.depth);
    for (const layer of this.depthLayers) {
      layer.style.setProperty('--holo-dx', depth.x.toFixed(DEPTH_DIGITS));
      layer.style.setProperty('--holo-dy', depth.y.toFixed(DEPTH_DIGITS));
    }
  }
}
