// The foil's tint follows the painting (holo redo, 2026-11-20): one pure function from RGBA pixels to three CSS
// colours. No DOM, so the unit test feeds it plain arrays; holo-card-faces.ts samples the image into it.
import { FOIL_TINT } from './constants';

const CHANNEL = 255;
const TURN = 360;
const SIXTH = 60;
const SECTORS = 6; // the hue wheel in sixths (the standard RGB to HSL conversion)
const BLUE_SECTOR = 4; // where blue-dominant colours start, in those sixths
const RGBA = 4;
const ALPHA_OFFSET = 3; // alpha's place in one RGBA pixel
const SWATCHES = 3;
const HALF = 0.5;

/** Hue in degrees and HSL saturation and lightness (0 to 1) of one 0..255 RGB pixel. */
function hsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / CHANNEL, g / CHANNEL, b / CHANNEL];
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  const l = (max + min) * HALF;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const sector = max === rn ? ((gn - bn) / d + SECTORS) % SECTORS : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + BLUE_SECTOR;
  return { h: sector * SIXTH, s, l };
}

const counts = (pixel: { s: number; l: number }, alpha: number) =>
  alpha >= FOIL_TINT.minAlpha && pixel.s >= FOIL_TINT.minSaturation &&
  pixel.l >= FOIL_TINT.minLightness && pixel.l <= FOIL_TINT.maxLightness;

/** Degrees between two hues the short way round the wheel. */
const spread = (a: number, b: number) => Math.min(Math.abs(a - b), TURN - Math.abs(a - b));

const css = (hue: number) => `hsl(${Math.round(hue) % TURN} ${FOIL_TINT.saturation}% ${FOIL_TINT.lightness}%)`;

/**
 * The three foil colours for a painting, `rgba` flattened like ImageData.data: the mean hue of each of the three
 * most common hue families among its colourful pixels, most common first. Fewer families fill with neighbours of
 * the first; none gives the fallback.
 */
export function foilTint(rgba: ArrayLike<number>): string[] {
  const families = hueFamilies(rgba);
  const hues: number[] = [];
  for (const hue of families) {
    if (hues.length < SWATCHES && hues.every(chosen => spread(chosen, hue) >= FOIL_TINT.minSpread)) hues.push(hue);
  }
  if (hues.length === 0) return FOIL_TINT.fallback.map(css);
  const first = hues[0]!;
  while (hues.length < SWATCHES) hues.push(first + hues.length * FOIL_TINT.fillStep);
  return hues.map(css);
}

/**
 * The foil's band colours (holo redo 2, 2026-11-20): the painting's main hue, then gold and cyan, the colours a
 * printed holo flashes, so the bands still read on a dark one-colour painting whose own hue vanishes into it. An
 * accent too close to the main hue gives its place to the painting's next family; short lists fill as foilTint does.
 */
export function foilBands(rgba: ArrayLike<number>): string[] {
  const families = hueFamilies(rgba);
  if (families.length === 0) return FOIL_TINT.fallback.map(css);
  const hues = [families[0]!];
  const far = (hue: number) => hues.every(chosen => spread(chosen, hue) >= FOIL_TINT.minSpread);
  for (const hue of [...FOIL_TINT.accents, ...families.slice(1)]) if (hues.length < SWATCHES && far(hue)) hues.push(hue);
  while (hues.length < SWATCHES) hues.push(hues[0]! + hues.length * FOIL_TINT.fillStep);
  return hues.map(css);
}

/** Mean hue of each hue family among the painting's colourful pixels, most common family first. */
function hueFamilies(rgba: ArrayLike<number>): number[] {
  const bins = new Map<number, { sum: number; n: number }>();
  for (let i = 0; i + RGBA - 1 < rgba.length; i += RGBA) {
    const pixel = hsl(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    if (!counts(pixel, rgba[i + ALPHA_OFFSET]!)) continue;
    const key = Math.floor(pixel.h / FOIL_TINT.binDegrees);
    const bin = bins.get(key) ?? { sum: 0, n: 0 };
    bins.set(key, { sum: bin.sum + pixel.h, n: bin.n + 1 });
  }
  return [...bins.values()].sort((a, b) => b.n - a.n).map(bin => bin.sum / bin.n);
}
