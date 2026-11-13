import { AUDIO_UNLOCK_EVENTS } from "./audio-constants.ts";

/** The one Web Audio context of this page, and the way back to sound after the browser silences it. */
export interface AudioRuntime {
  /** The shared context, made on first call; null where Web Audio does not exist. */
  context(): AudioContext | null;
  /** Ask a suspended or interrupted context to run. Never rejects, and never waits on an earlier ask. */
  resume(): Promise<void>;
}

export interface SharedAudioRuntime extends AudioRuntime {
  /** True for the shared context, so a client never closes what other sounds still use. */
  owns(candidate: unknown): boolean;
}

/** What the runtime reads from its page; injected so tests can drive it. */
export interface RuntimeEnv {
  Ctor: (new () => AudioContext) | undefined;
  document: EventTarget & { hidden: boolean };
  window: EventTarget;
}

type Scope = { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };

function needsResume(context: AudioContext): boolean {
  return (context.state as string) !== "running" && (context.state as string) !== "closed";
}

export function createAudioRuntime(environment: () => RuntimeEnv): SharedAudioRuntime {
  let shared: AudioContext | null = null;
  let attempted = false;

  // Each ask goes straight to the context. A context asked outside a gesture can leave its promise pending forever,
  // so a shared in-flight promise would swallow the tap that is allowed to start it.
  const resume = (): Promise<void> => {
    if (!shared || !needsResume(shared)) return Promise.resolve();
    return shared.resume().catch(() => {});
  };

  /** iOS only lets a context start from a touch end, click or key press, and takes it back on lock, call or another app's audio. */
  const watch = (context: AudioContext, env: RuntimeEnv) => {
    const gesture = () => { void resume(); };
    const visible = () => { if (!env.document.hidden) void resume(); };
    for (const type of AUDIO_UNLOCK_EVENTS) env.document.addEventListener(type, gesture, { capture: true, passive: true });
    env.document.addEventListener("visibilitychange", visible);
    env.window.addEventListener("pageshow", visible);
    context.addEventListener?.("statechange", visible);
  };

  const context = (): AudioContext | null => {
    if (attempted) return shared;
    attempted = true;
    const env = environment();
    if (!env.Ctor) return null;
    try { shared = new env.Ctor(); } catch { shared = null; return null; }
    watch(shared, env);
    return shared;
  };

  return { context, resume, owns: (candidate) => shared !== null && candidate === shared };
}

function browserEnv(): RuntimeEnv {
  const scope = globalThis as unknown as Scope;
  return { Ctor: scope.AudioContext ?? scope.webkitAudioContext, document, window: globalThis as unknown as EventTarget };
}

export const audioRuntime = createAudioRuntime(browserEnv);
