// LOOK TEST (2026-11-20): each scene's image, made by game/scripts/holo-scenes/generate.mjs through the builder's
// local Codex pipeline and resized to 700x980 WebP. Adding one: add it to scenes.json, generate, convert, list it here
// and in SCENES (holo-card-model.ts).
import chomper from '../art/scenes/scene-chomper.webp';
import cloud from '../art/scenes/scene-cloud.webp';
import puff from '../art/scenes/scene-puff.webp';
import burgerAltA from '../art/scenes/alt-burger-a.webp';
import burgerAltB from '../art/scenes/alt-burger-b.webp';
import chomperAltA from '../art/scenes/alt-chomper-a.webp';
import chomperAltB from '../art/scenes/alt-chomper-b.webp';
import hoodieAltA from '../art/scenes/alt-hoodie-a.webp';
import hoodieAltB from '../art/scenes/alt-hoodie-b.webp';
import puffAltA from '../art/scenes/alt-puff-a.webp';
import puffAltB from '../art/scenes/alt-puff-b.webp';
import slimeAltA from '../art/scenes/alt-slime-a.webp';
import slimeAltB from '../art/scenes/alt-slime-b.webp';
import sproutAltA from '../art/scenes/alt-sprout-a.webp';
import sproutAltB from '../art/scenes/alt-sprout-b.webp';
import type { Scene } from './holo-card-model';

export const SCENE_ART: Readonly<Record<Scene, string>> = { puff, chomper, cloud };

/** Alt art paintings, keyed `<resident>-<variant>` (scenes.json `<resident>-alt-a|b`). A: an action moment with the
 *  resident's signature ability; B: a quiet moment from its life. */
export const ALT_ART_IMAGES: Readonly<Record<string, string>> = {
  'sprout-a': sproutAltA, 'sprout-b': sproutAltB,
  'slime-a': slimeAltA, 'slime-b': slimeAltB,
  'burger-a': burgerAltA, 'burger-b': burgerAltB,
  'hoodie-a': hoodieAltA, 'hoodie-b': hoodieAltB,
  'puff-a': puffAltA, 'puff-b': puffAltB,
  'chomper-a': chomperAltA, 'chomper-b': chomperAltB,
};
