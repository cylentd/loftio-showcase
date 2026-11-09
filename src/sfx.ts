import { SFX } from "./sfx-data.ts";

/** The slice of the Web Audio API the engine uses, so tests can pass a fake that records what is scheduled. */
interface SfxNode { connect(to: unknown): unknown }
interface SfxValue { value: number }
export interface SfxContext {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state: string;
  resume(): Promise<unknown>;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  createBufferSource(): SfxNode & { buffer: unknown; playbackRate: SfxValue; detune: SfxValue; start(time: number): void };
  createGain(): SfxNode & { gain: SfxValue };
}

/** What a pile tells the player's ears. */
export interface StackSounds {
  plop(level: number, quiet?: boolean): void;
  topple(count: number, quiet?: boolean): void;
}

export interface SfxDeps {
  /** Makes the browser's audio context; null when there is none. Called at most once, after unlock. */
  create(): SfxContext | null;
  /** False while the room's sound is muted. */
  audible(): boolean;
  hidden(): boolean;
  /** Fetches a clip's bytes by its path under the site's base. */
  fetchBytes(path: string): Promise<ArrayBuffer>;
  /** A number in [0, 1), for detune. */
  random(): number;
}

type Clip = "land" | "topple";

/** Plops and topples. Silent until `unlock()`, while muted, while the tab is hidden and until the clips have decoded. */
export class Sfx implements StackSounds {
  private unlocked = false;
  private context: SfxContext | null = null;
  private master: (SfxNode & { gain: SfxValue }) | null = null;
  private readonly buffers: Partial<Record<Clip, unknown>> = {};
  private readonly deps: SfxDeps;
  constructor(deps: SfxDeps) { this.deps = deps; }

  /** Call from a user gesture's aftermath (the intro's ready callback). No audio context exists before this; the clips start loading here so the first stack is not silent. */
  unlock(): void {
    this.unlocked = true;
    if (!this.deps.hidden()) this.open();
  }

  /** The landing clip, a scale step up per pile level (1 is the lowest). */
  plop(level: number, quiet = false): void {
    const ctx = this.ready();
    if (ctx) this.voice(ctx, "land", this.step(level - 1), ctx.currentTime, SFX.peak * this.scale(quiet));
  }

  /** `count` voices falling in pitch, one per resident, each a little after the last. */
  topple(count: number, quiet = false): void {
    if (count < 1) return;
    const ctx = this.ready();
    if (!ctx) return;
    for (let i = 0; i < count; i++) {
      this.voice(ctx, "topple", this.step(count - 1 - i), ctx.currentTime + i * SFX.toppleGapS, SFX.peak * SFX.toppleGain * this.scale(quiet));
    }
  }

  private scale(quiet: boolean): number { return quiet ? SFX.quietFactor : 1; }

  /** Playback rate for a scale step. */
  private step(step: number): number {
    const top = SFX.scaleSemitones.length - 1;
    const semitones = SFX.scaleSemitones[Math.max(0, Math.min(top, step))]!;
    return 2 ** (semitones / SFX.semitonesPerOctave);
  }

  private ready(): SfxContext | null {
    if (!this.unlocked || this.deps.hidden() || !this.deps.audible()) return null;
    const ctx = this.open();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }

  /** Makes the context and starts loading both clips, once. */
  private open(): SfxContext | null {
    if (this.context) return this.context;
    try { this.context = this.deps.create(); } catch { this.context = null; }
    if (!this.context) return null;
    this.master = this.context.createGain();
    this.master.gain.value = SFX.master;
    this.master.connect(this.context.destination);
    this.load(this.context, "land", SFX.landFile);
    this.load(this.context, "topple", SFX.toppleFile);
    return this.context;
  }

  /** Fetch and decode one clip; a failure leaves that clip silent. */
  private load(ctx: SfxContext, clip: Clip, path: string): void {
    this.deps.fetchBytes(path).then(bytes => ctx.decodeAudioData(bytes)).then(buffer => { this.buffers[clip] = buffer; }).catch(() => {});
  }

  private voice(ctx: SfxContext, clip: Clip, rate: number, at: number, peak: number): void {
    const buffer = this.buffers[clip];
    if (!buffer) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.detune.value = (this.deps.random() * 2 - 1) * SFX.detuneCents;
    gain.gain.value = peak;
    src.connect(gain); gain.connect(this.master!);
    src.start(at);
  }
}

/** The real thing: one AudioContext of the browser's, made on first use after unlock. */
export function browserSfx(audible: () => boolean): Sfx {
  const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const base = import.meta.env.BASE_URL;
  return new Sfx({
    create: () => (Ctor ? new Ctor() : null), audible, hidden: () => document.hidden,
    fetchBytes: path => fetch(base + path).then(res => { if (!res.ok) throw new Error(String(res.status)); return res.arrayBuffer(); }),
    random: Math.random,
  });
}
