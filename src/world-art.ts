import { LEAF_ART } from './intro-data.ts';

/** Painted UI art in public/, drawn by the treehouse skin. Frame and basket come from scripts/clean_brand_art.py;
 *  the window frame from scripts/prepare_window_frame.py (manifest: art/ui/treehouse-v1/manifest.json). */
export const WORLD_ART = {
  frame: 'brand/frame-treehouse.webp',
  'window-frame': 'art/skin-treehouse/window_frame.webp',
  basket: 'brand/basket-treehouse.webp',
  // The blind box's printed panels, lid and seal, from scripts/prepare_box_art.py.
  'box-front': 'brand/box-front.webp',
  'box-right': 'brand/box-right.webp',
  'box-lid': 'brand/box-lid.webp',
  'box-seal': 'brand/box-seal.webp',
  'leaf-1': LEAF_ART[0],
  'leaf-2': LEAF_ART[1],
  'leaf-3': LEAF_ART[2],
} as const;

// Made absolute here, like the intro's art: a relative url() in a custom property resolves
// against the bundled stylesheet in assets/, not the page.
export function applyWorldArt(root: HTMLElement, base: string) {
  for (const [name, path] of Object.entries(WORLD_ART)) root.style.setProperty('--art-' + name, `url("${new URL(path, base).href}")`);
}
