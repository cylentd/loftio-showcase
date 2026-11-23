// Foil textures drawn by our code at load (look test `&holocompare`, 2026-11-20): a cosmos field (stars and soft
// colour clouds), a second star field for the twinkle, and a glitter field. Each is a canvas painted once, handed to
// CSS as a custom property on the root; holo-types.css tiles them. A seeded generator keeps every load the same.

// Texture sizes and densities: starting values judged from the first capture (look test, 2026-11-20), not measured.
const TEXTURE_SIZE = 384; // canvas side, px; tiled at about two thirds of this on the big card (holo-types.css)
const COSMOS_STARS = 1500; // dense enough to read as a speckle at a glance
const TWINKLE_STARS = 260;
const CLOUD_COUNT = 9; // soft colour clouds behind the stars
const GLITTER_FLECKS = 2400; // flecks in the rainbow field
const STAR_MIN = 0.5; // star radius range, px: most stars are near the small end (the draw is squared)
const STAR_MAX = 3.4;
const FLARE_AT = 0.82; // a star larger than this share of the range gets a four-point flare
const FLARE_LENGTH = 4; // flare arm, in star radii
const CLOUD_MIN = 0.12; // cloud radius range as a share of the canvas side
const CLOUD_MAX = 0.3;
const CLOUD_ALPHA = 0.7; // a cloud's centre opacity
const DEEP_SHARE = 0.45; // share of stars in a deep colour rather than near-white, so the speckle reads on a bright sky too
const FLECK_MIN = 0.8; // glitter fleck size range, px
const FLECK_MAX = 2.2;
const FLECK_ALPHA = 0.35; // glitter fleck opacity floor; the rest of each fleck's opacity is random
const SEED_COSMOS = 7; // any distinct values work; fixed so every load looks the same
const SEED_TWINKLE = 31;
const SEED_GLITTER = 113;

/** The texture sizes, densities and seeds, gathered for the painters below. */
export const HOLO_TEXTURE = {
  size: TEXTURE_SIZE, cosmosStars: COSMOS_STARS, twinkleStars: TWINKLE_STARS, clouds: CLOUD_COUNT, glitter: GLITTER_FLECKS,
  starMin: STAR_MIN, starMax: STAR_MAX, flareAt: FLARE_AT, flareLength: FLARE_LENGTH,
  cloudMin: CLOUD_MIN, cloudMax: CLOUD_MAX, cloudAlpha: CLOUD_ALPHA, deepShare: DEEP_SHARE,
  fleckMin: FLECK_MIN, fleckMax: FLECK_MAX, fleckAlpha: FLECK_ALPHA,
  seeds: { cosmos: SEED_COSMOS, twinkle: SEED_TWINKLE, glitter: SEED_GLITTER },
} as const;

const TURN = 360;
const WHITE = 100;
const FULL_CIRCLE = Math.PI * 2;
/** Star colours: near-white with a hue (lightness 92%), or deep (lightness 42%), at full saturation. */
const LIGHT = { s: 90, l: 92 };
const DEEP = { s: 85, l: 42 };
const CLOUD = { s: 80, l: 55 };
/** Cloud hues: violet, magenta, teal and blue, the colours of a printed galaxy holo. */
const CLOUD_HUES = [270, 315, 185, 220];

// mulberry32 (Tommy Ettinger, public domain): the published increment, shifts and odd mask.
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_FIRST = 15;
const MULBERRY_SHIFT_SECOND = 7;
const MULBERRY_ODD_MASK = 61;
const MULBERRY_SHIFT_THIRD = 14;
const UINT32_RANGE = 4294967296; // 2 ** 32

/** mulberry32: a small seeded generator, [0, 1). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_FIRST), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_SECOND), t | MULBERRY_ODD_MASK);
    return ((t ^ (t >>> MULBERRY_SHIFT_THIRD)) >>> 0) / UINT32_RANGE;
  };
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsl(${Math.round(h)} ${s}% ${l}% / ${a})`;

function canvas(): { node: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const node = document.createElement('canvas');
  node.width = node.height = HOLO_TEXTURE.size;
  const g = node.getContext('2d');
  return g ? { node, g } : null;
}

function star(g: CanvasRenderingContext2D, rnd: () => number, deep: boolean): void {
  const t = HOLO_TEXTURE, side = t.size, share = rnd() ** 2;
  const x = rnd() * side, y = rnd() * side, r = t.starMin + share * (t.starMax - t.starMin);
  const tone = deep ? DEEP : LIGHT;
  g.fillStyle = hsl(rnd() * TURN, tone.s, tone.l);
  g.beginPath(); g.arc(x, y, r, 0, FULL_CIRCLE); g.fill();
  if (share < t.flareAt) return;
  g.strokeStyle = g.fillStyle;
  g.lineWidth = r / 2;
  g.beginPath();
  g.moveTo(x - r * t.flareLength, y); g.lineTo(x + r * t.flareLength, y);
  g.moveTo(x, y - r * t.flareLength); g.lineTo(x, y + r * t.flareLength);
  g.stroke();
}

function clouds(g: CanvasRenderingContext2D, rnd: () => number): void {
  const t = HOLO_TEXTURE, side = t.size;
  for (let i = 0; i < t.clouds; i++) {
    const x = rnd() * side, y = rnd() * side, r = side * (t.cloudMin + rnd() * (t.cloudMax - t.cloudMin));
    const hue = CLOUD_HUES[i % CLOUD_HUES.length]!;
    const fill = g.createRadialGradient(x, y, 0, x, y, r);
    fill.addColorStop(0, hsl(hue, CLOUD.s, CLOUD.l, t.cloudAlpha));
    fill.addColorStop(1, hsl(hue, CLOUD.s, CLOUD.l, 0));
    g.fillStyle = fill;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function stars(count: number, seed: number, withClouds: boolean): string | null {
  const c = canvas();
  if (!c) return null;
  const rnd = seeded(seed);
  if (withClouds) clouds(c.g, rnd);
  for (let i = 0; i < count; i++) star(c.g, rnd, rnd() < HOLO_TEXTURE.deepShare);
  return blobUrl(c.node);
}

/**
 * A short blob: URL for a painted canvas. A data: URL is hundreds of kilobytes, and a custom property holding it is
 * re-substituted on every style recalc of every foil layer that reads it: with the tilt writing properties each
 * frame, that cost 1.8 s of style work in a 2 s trace (holo integrated, 2026-11-20). Synchronous, so the textures
 * are set before the first frame.
 */
function blobUrl(node: HTMLCanvasElement): string {
  const [head, body] = node.toDataURL().split(',');
  const bytes = Uint8Array.from(atob(body!), char => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: head!.slice('data:'.length, head!.indexOf(';')) }));
}

/** White flecks of varied size and strength: the rainbow foil shows only through them (a mask reads alpha). */
function glitter(): string | null {
  const c = canvas();
  if (!c) return null;
  const t = HOLO_TEXTURE, rnd = seeded(t.seeds.glitter);
  for (let i = 0; i < t.glitter; i++) {
    const size = t.fleckMin + rnd() * (t.fleckMax - t.fleckMin);
    c.g.fillStyle = hsl(0, 0, WHITE, t.fleckAlpha + rnd() * (1 - t.fleckAlpha));
    c.g.fillRect(rnd() * t.size, rnd() * t.size, size, size);
  }
  return blobUrl(c.node);
}

let painted = false;

/** Paints the three textures once and sets `--hx-tex-cosmos`, `--hx-tex-twinkle` and `--hx-tex-glitter` on the root. */
export function paintHoloTextures(): void {
  if (painted) return;
  painted = true;
  const t = HOLO_TEXTURE;
  const set = (name: string, url: string | null) => { if (url) document.documentElement.style.setProperty(name, `url("${url}")`); };
  set('--hx-tex-cosmos', stars(t.cosmosStars, t.seeds.cosmos, true));
  set('--hx-tex-twinkle', stars(t.twinkleStars, t.seeds.twinkle, false));
  set('--hx-tex-glitter', glitter());
}
