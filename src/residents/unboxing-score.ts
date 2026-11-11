export type SoundCue = { kind: 'tone' | 'noise'; at: number; duration: number; attack: number; pitch: number; gain: number; wave?: OscillatorType };

export const REVEAL_SCORE: Record<'intro' | 'opening', readonly SoundCue[]> = {
  intro: [
    { kind: 'noise', at: 0, duration: 1.5, attack: 0.8, pitch: 620, gain: 0.16 },
    { kind: 'tone', at: 0, duration: 2.2, attack: 0.9, pitch: 130.81, gain: 0.2, wave: 'sine' },
    { kind: 'tone', at: 0.2, duration: 2, attack: 0.8, pitch: 196, gain: 0.13, wave: 'sine' },
    { kind: 'tone', at: 0.5, duration: 1.7, attack: 0.7, pitch: 293.66, gain: 0.08, wave: 'triangle' },
    { kind: 'noise', at: 1.65, duration: 0.12, attack: 0.01, pitch: 380, gain: 0.26 },
  ],
  opening: [
    { kind: 'tone', at: 0, duration: 2.8, attack: 1.8, pitch: 130.81, gain: 0.24, wave: 'sine' },
    { kind: 'tone', at: 0.25, duration: 2.5, attack: 1.5, pitch: 196, gain: 0.16, wave: 'sine' },
    { kind: 'tone', at: 0.6, duration: 2, attack: 1.2, pitch: 293.66, gain: 0.12, wave: 'triangle' },
    { kind: 'noise', at: 0.25, duration: 0.65, attack: 0.1, pitch: 2400, gain: 0.28 },
    { kind: 'noise', at: 1.2, duration: 0.16, attack: 0.01, pitch: 820, gain: 0.24 },
    { kind: 'noise', at: 1.6, duration: 0.5, attack: 0.12, pitch: 3600, gain: 0.15 },
    { kind: 'noise', at: 2.3, duration: 0.65, attack: 0.2, pitch: 1100, gain: 0.15 },
    { kind: 'tone', at: 2.4, duration: 1.5, attack: 0.025, pitch: 329.63, gain: 0.28, wave: 'triangle' },
    { kind: 'tone', at: 2.52, duration: 1.5, attack: 0.025, pitch: 392, gain: 0.22, wave: 'sine' },
    { kind: 'tone', at: 2.64, duration: 1.5, attack: 0.025, pitch: 523.25, gain: 0.23, wave: 'triangle' },
    { kind: 'tone', at: 2.8, duration: 1.6, attack: 0.03, pitch: 1046.5, gain: 0.09, wave: 'sine' },
  ],
};
