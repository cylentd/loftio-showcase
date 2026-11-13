import type { AudioPort } from "./audio-model.ts";
import { audioRuntime, type AudioRuntime } from "./audio-runtime.ts";

/**
 * An AudioPort whose loudness is a gain node's, because iOS Safari ignores `media.volume`.
 * Each element is attached once, at its first play, so the graph already exists when sound starts.
 * Without Web Audio, or if the element cannot attach, the element's own volume is used.
 */
export function gainPort(media: HTMLAudioElement, runtime: AudioRuntime = audioRuntime): AudioPort {
  let level = media.volume;
  let gain: GainNode | null = null;
  let attached = false;
  const apply = () => { if (gain) gain.gain.value = level; else media.volume = level; };
  const attach = () => {
    if (attached) return;
    attached = true;
    const context = runtime.context();
    if (!context || context.state === "closed") return;
    try {
      const node = context.createGain();
      context.createMediaElementSource(media).connect(node);
      node.connect(context.destination);
      gain = node; media.volume = 1;
    } catch { gain = null; }
    apply();
  };
  return {
    get volume() { return level; },
    set volume(value: number) { level = value; apply(); },
    get src() { return media.src; },
    set src(value: string) { media.src = value; },
    get currentTime() { return media.currentTime; },
    set currentTime(value: number) { media.currentTime = value; },
    get duration() { return media.duration; },
    play() { attach(); void runtime.resume(); return media.play(); },
    pause() { media.pause(); },
  };
}
