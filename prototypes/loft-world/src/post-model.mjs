// Pure parsing for the post-chain URL switches. Unknown or missing values give the default.
import { AA_MODES, DEFAULT_AA, BLOOM_MODES, DEFAULT_BLOOM, MSAA_SAMPLES, BLOOM_HALF_SCALE } from './post-data.mjs';

const pick = (text, modes, fallback) => {
  const name = (text ?? '').trim().toLowerCase();
  return modes.includes(name) ? name : fallback;
};

/** Edge smoothing mode from `?aa=`. */
export const parseAa = (text) => pick(text, AA_MODES, DEFAULT_AA);

/** Bloom size mode from `?bloom=`. */
export const parseBloom = (text) => pick(text, BLOOM_MODES, DEFAULT_BLOOM);

/** Factor applied to the composer size before the bloom pass sees it. */
export const bloomScale = (mode) => (mode === 'half' ? BLOOM_HALF_SCALE : 1);

/** Samples for the composer target: only msaa asks for them, and phones and the bench `off=msaa` switch drop them. */
export function msaaSamples({ aa, low, off }) {
  return aa === 'msaa' && !low && !off.includes('msaa') ? MSAA_SAMPLES : 0;
}
