import { REVEAL_SOUND } from './unboxing-constants.ts';
import { REVEAL_SCORE, type SoundCue } from './unboxing-score.ts';

export type RevealAudioPreference = { readonly playing: boolean; readonly enabled?: boolean; subscribe(listener: () => void): void; suspend?(): () => void };
export type RevealCue = 'intro' | 'opening';

function noise(context: AudioContext, duration: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed: number = REVEAL_SOUND.noiseSeed;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * REVEAL_SOUND.noiseMultiplier + REVEAL_SOUND.noiseIncrement) >>> 0;
    samples[index] = seed / REVEAL_SOUND.noiseMaximum * 2 - 1;
  }
  return buffer;
}

function schedule(context: AudioContext, destination: AudioNode, cue: SoundCue) {
  const source = cue.kind === 'tone' ? context.createOscillator() : context.createBufferSource();
  if (cue.kind === 'tone') {
    (source as OscillatorNode).type = cue.wave ?? 'sine';
    (source as OscillatorNode).frequency.setValueAtTime(cue.pitch, context.currentTime + cue.at);
  } else (source as AudioBufferSourceNode).buffer = noise(context, cue.duration);
  const gain = context.createGain(), start = context.currentTime + cue.at, end = start + cue.duration;
  gain.gain.setValueAtTime(REVEAL_SOUND.floor, start);
  gain.gain.linearRampToValueAtTime(cue.gain, start + cue.attack);
  gain.gain.exponentialRampToValueAtTime(REVEAL_SOUND.floor, end);
  if (cue.kind === 'noise') {
    const filter = context.createBiquadFilter(); filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cue.pitch, start);
    source.connect(filter); filter.connect(gain);
  } else source.connect(gain);
  gain.connect(destination); source.start(start); source.stop(end + REVEAL_SOUND.release);
  return source;
}

export function createRevealSound(enabled: () => boolean, factory: () => AudioContext = () => new AudioContext()) {
  let context: AudioContext | null = null, disposed = false, failed = false;
  let sources: AudioScheduledSourceNode[] = [];
  const stop = () => {
    for (const source of sources) { try { source.stop(context?.currentTime ?? 0); source.disconnect(); } catch {} }
    sources = [];
  };
  const play = (cue: RevealCue) => {
    stop();
    if (disposed || failed || !enabled()) return;
    try {
      context ??= factory();
      if (context.state === 'suspended') void context.resume().catch(() => { failed = true; stop(); });
      const master = context.createGain(); master.gain.value = REVEAL_SOUND.volume; master.connect(context.destination);
      for (const note of REVEAL_SCORE[cue]) sources.push(schedule(context, master, note));
    } catch { failed = true; stop(); }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; stop();
    if (context) void context.close().catch(() => {});
  };
  return { play, stop, dispose };
}
