// The look-only art parameter (#565): `?mode=mock&storybook&art=<base url>` loads the cover, endpaper and paper
// candidates from the capture store. Mock mode and the page's own origin only; anything else is ignored, and a file
// that fails to load leaves the code-drawn surface in place.
import { ART_FORMATS, ART_PHASES, STORYBOOK_ART, type ArtPart } from './constants';
import cover from './shelf-cover.webp';
import endpaper from './book-endpaper.webp';
import paper from './book-paper.webp';

type ArtSource = string | Partial<Record<ArtPart, string>>;
const bundled: ArtSource = { cover, endpaper, paper };

export function storybookArt(search: string, pageUrl: string): ArtSource[] {
  return [...artBases(search, pageUrl), bundled];
}

/** The art base URL (ending in `/`), or null when the look URL has none, is not mock, or points at another origin. */
export function artBase(search: string, pageUrl: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('art');
  if (params.get('mode') !== 'mock' || !raw) return null;
  let url: URL;
  try { url = new URL(raw, pageUrl); } catch { return null; }
  if (url.origin !== new URL(pageUrl).origin) return null;
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
}

/** S4: `art=` may list several bases, comma separated (the book art and the sketches sit in different run folders).
 *  Each passes artBase's own checks; one that fails is dropped. */
export function artBases(search: string, pageUrl: string): string[] {
  const params = new URLSearchParams(search);
  return (params.get('art') ?? '').split(',').flatMap(raw => {
    const one = new URLSearchParams(params);
    one.set('art', raw.trim());
    const base = artBase(`?${one}`, pageUrl);
    return base ? [base] : [];
  });
}

/** S5: the files to try for one part, in order: each base's web-size .webp, then its .png, base by base. */
export function artSources(bases: readonly ArtSource[], part: ArtPart): string[] {
  return bases.flatMap(base => {
    if (typeof base === 'string') return ART_FORMATS.map(format => `${base}${STORYBOOK_ART[part]}.${format}`);
    const source = base[part];
    return source ? [source] : [];
  });
}

/** Loads each part from the first source that decodes (artSources); a loaded part sets `--sb-<part>-art` on `root` and
 *  marks `data-art-<part>`. A part with no source keeps its code-drawn surface. */
export function loadArt(root: HTMLElement, bases: string | readonly ArtSource[], load: Loader = loadImage,
  parts: readonly ArtPart[] = Object.keys(STORYBOOK_ART) as ArtPart[]): Promise<void>[] {
  const list = typeof bases === 'string' ? [bases] : bases;
  return parts.map(async part => {
    for (const src of artSources(list, part)) {
      let shown: string | void;
      try { shown = await load(src); } catch { continue; }
      root.style.setProperty(`--sb-${part}-art`, `url("${shown || src}")`);
      root.dataset[`art${part[0]!.toUpperCase()}${part.slice(1)}`] = 'painted';
      return;
    }
  });
}

/** S5 load order: each phase starts once the one before has settled, loaded or not (ART_PHASES). */
export async function loadArtInOrder(root: HTMLElement, bases: readonly ArtSource[], load: Loader = loadImage): Promise<void> {
  for (const phase of ART_PHASES) await Promise.all(loadArt(root, bases, load, phase));
}

/** Starts fetching and decoding the cover before the book is asked for, so the tap finds it ready. Resolves once a
 *  source has decoded, or every one has failed; never rejects. A second call joins the first (loadImage shares). */
export function preloadCover(bases: readonly ArtSource[], load: Loader = loadImage): Promise<void> {
  return (async () => { for (const src of artSources(bases, 'cover')) { try { await load(src); return; } catch { /* next source */ } } })();
}

/** Waits for the cover up to `ms`, so the flight can carry the painted cover; past that the code-drawn one flies and
 *  the painted one crossfades in after landing. `wait` is the timer, injected so tests never sleep. */
export function coverOrTimeout(bases: readonly ArtSource[], ms: number, wait: (ms: number) => Promise<void> = sleep,
  load: Loader = loadImage): Promise<void> {
  return coverDecoded(bases) ? Promise.resolve() : Promise.race([preloadCover(bases, load), wait(ms)]);
}
const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

/** Runs `work` once the page is idle (requestIdleCallback), or after `ms` at most; a timer where idle callbacks are
 *  missing (Safari). The room boot has the network and main thread first. */
export function whenIdle(work: () => void, ms: number): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => work(), { timeout: ms });
  else setTimeout(work, ms);
}

/** S6: true once a cover source has decoded, so the flight knows whether to fly the painted cover or the code-drawn one
 *  (the painted one then crossfades in after landing, never mid-flight). */
export function coverDecoded(bases: readonly ArtSource[]): boolean {
  return artSources(bases, 'cover').some(src => ready.has(src));
}

/** Fetches and decodes one file; resolves with the URL the CSS should use, or nothing to use `src` itself. */
export type Loader = (src: string) => Promise<string | void>;

/** One shared fetch and decode per file: the preload and the page's own load are the same promise. The bytes are held
 *  as a blob URL, so the CSS that paints them never asks the network again: the art server sends `no-store`, and a
 *  plain `url(src)` set seconds after the preload fetched the 252 KB cover a second time (measured 2026-11-21). */
const decoded = new Map<string, Promise<string>>();
const ready = new Set<string>();
function loadImage(src: string): Promise<string> {
  let held = decoded.get(src);
  if (!held) {
    held = fetch(src).then(response => {
      if (!response.ok) throw new Error(`${response.status} ${src}`);
      return response.blob();
    }).then(async blob => {
      const url = URL.createObjectURL(blob), image = new Image();
      image.src = url;
      await image.decode();
      return url;
    });
    held.then(() => ready.add(src), () => decoded.delete(src));
    decoded.set(src, held);
  }
  return held;
}

