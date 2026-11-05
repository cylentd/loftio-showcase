import { SONG_WAVE } from "./song-wave-data.ts";

/** How far through the song, 0 to 1. Before the browser knows the length it reads as the start. */
export function songFraction(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(1, current / duration));
}

export function clockText(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export interface Wave { end: number; middle: number; amplitude: number; wavelength: number; phase: number }

/** An SVG path for the played part of the song: a sine wave from x 0 to `end`. `phase` is in wavelengths. */
export function wavePath({ end, middle, amplitude, wavelength, phase }: Wave): string {
  const y = (x: number) => middle + amplitude * Math.sin(2 * Math.PI * (x / wavelength - phase));
  const round = (n: number) => Math.round(n * 100) / 100;
  let path = `M0 ${round(y(0))}`;
  for (let x = SONG_WAVE.sampleStep; x < end; x += SONG_WAVE.sampleStep) path += ` L${round(x)} ${round(y(x))}`;
  if (end > 0) path += ` L${round(end)} ${round(y(end))}`;
  return path;
}

/** Move the wave's height toward its target, linearly over `SONG_WAVE.settleMs`, without overshooting. */
export function settleAmplitude(current: number, target: number, elapsedMs: number): number {
  const step = SONG_WAVE.amplitude * elapsedMs / SONG_WAVE.settleMs;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}
