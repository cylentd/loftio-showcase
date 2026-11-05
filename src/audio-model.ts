export interface AudioPort { volume: number; src: string; currentTime: number; play(): Promise<void>; pause(): void }
export class Soundtrack {
  desired = false;
  playing = false;
  failed = false;
  private hidden = false;
  private revision = 0;
  private fadeTarget: number | null = null;
  private readonly audio: AudioPort;
  private readonly changed: () => void;
  private readonly listeners = new Set<() => void>();
  constructor(audio: AudioPort, changed = () => {}) { this.audio = audio; this.changed = changed; }
  async start(): Promise<void> {
    this.desired = true;
    this.failed = false;
    await this.reconcile();
  }
  async stop(): Promise<void> {
    this.desired = false;
    this.failed = false;
    await this.reconcile();
  }
  subscribe(listener: () => void): void { this.listeners.add(listener); }
  private notify(): void { this.changed(); for (const listener of this.listeners) listener(); }

  async toggle(): Promise<void> {
    this.desired = !this.desired;
    this.failed = false;
    await this.reconcile();
  }
  async select(source: string): Promise<void> {
    this.audio.pause();
    this.playing = false;
    this.audio.src = source;
    this.audio.currentTime = 0;
    this.failed = false;
    await this.reconcile();
  }
  async visibility(hidden: boolean): Promise<void> {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    await this.reconcile();
  }
  volume(value: number): void {
    if (!Number.isFinite(value)) return;
    this.fadeTarget = null;  // a person's choice outranks a fade in progress
    this.audio.volume = Math.max(0, Math.min(1, value));
  }
  /** Drop to silence, remembering the current volume as the level `fadeStep(1)` returns to. */
  beginFade(): void {
    this.fadeTarget = this.audio.volume;
    this.audio.volume = 0;
  }
  /** Set the fade's progress, 0 to 1. Eases out, so the sound arrives quickly and settles gently. */
  fadeStep(progress: number): void {
    if (this.fadeTarget === null) return;
    const t = Math.max(0, Math.min(1, progress));
    this.audio.volume = this.fadeTarget * (1 - (1 - t) ** 2);
    if (t === 1) this.fadeTarget = null;
  }
  fail(): void {
    this.revision += 1;
    this.audio.pause();
    this.desired = this.playing = false;
    this.failed = true;
    this.notify();
  }
  private async reconcile(): Promise<void> {
    const revision = ++this.revision;
    if (!this.desired || this.hidden) {
      this.audio.pause();
      this.playing = false;
      this.notify();
      return;
    }
    this.notify();
    try {
      await this.audio.play();
      if (revision !== this.revision) return;
      this.playing = true;
    } catch {
      if (revision !== this.revision) return;
      this.desired = this.playing = false;
      this.failed = true;
    }
    this.notify();
  }
}
