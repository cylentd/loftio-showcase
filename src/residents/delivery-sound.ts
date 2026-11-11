import { DELIVERY as TUNE } from './delivery-constants';
import type { RevealAudioPreference } from './unboxing-sound';

export function deliverySound(audio: RevealAudioPreference) {
  let context: AudioContext | null = null;
  const sources = new Set<OscillatorNode>();
  const unlock = () => {
    if (!audio.playing) return;
    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch {}
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock, { passive: true });
  audio.subscribe(() => { if (!audio.playing) for (const source of sources) { try { source.stop(); } catch {} } });
  return () => {
    if (!audio.playing || context?.state !== 'running') return;
    const source = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
    source.frequency.setValueAtTime(TUNE.thumpPitch, now);
    source.frequency.exponentialRampToValueAtTime(TUNE.thumpEndPitch, now + TUNE.thumpDuration);
    gain.gain.setValueAtTime(TUNE.thumpGain, now);
    gain.gain.exponentialRampToValueAtTime(TUNE.silence, now + TUNE.thumpDuration);
    source.connect(gain); gain.connect(context.destination); sources.add(source);
    source.onended = () => { source.disconnect(); gain.disconnect(); sources.delete(source); };
    source.start(now); source.stop(now + TUNE.thumpDuration);
  };
}
