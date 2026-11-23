// Each card resident's two images (owner, 2026-11-20: every resident has one idle and one expression), made by
// game/scripts/prepare_holo_card_art.py. Adding a resident: run the script for its pair, add it here and to
// CARD_RESIDENTS in holo-card-model.ts.
import burgerExpression from '../art/crew/burger-card-expression.webp';
import burgerIdle from '../art/crew/burger-card-idle.webp';
import chomperExpression from '../art/crew/chomper-card-expression.webp';
import chomperIdle from '../art/crew/chomper-card-idle.webp';
import hoodieExpression from '../art/crew/hoodie-card-expression.webp';
import hoodieIdle from '../art/crew/hoodie-card-idle.webp';
import puffExpression from '../art/crew/puff-card-expression.webp';
import puffIdle from '../art/crew/puff-card-idle.webp';
import slimeExpression from '../art/crew/slime-card-expression.webp';
import slimeIdle from '../art/crew/slime-card-idle.webp';
import sproutExpression from '../art/crew/sprout-card-expression.webp';
import sproutIdle from '../art/crew/sprout-card-idle.webp';
import { HOLO_EXPRESSION_OFFSET, HOLO_NO_OFFSET } from './constants';
import type { OriginalId } from './holo-card-model';
import type { ResidentArt } from './holo-creature';

const PAIRS: Readonly<Record<OriginalId, { idle: string; expression: string }>> = {
  sprout: { idle: sproutIdle, expression: sproutExpression },
  slime: { idle: slimeIdle, expression: slimeExpression },
  burger: { idle: burgerIdle, expression: burgerExpression },
  hoodie: { idle: hoodieIdle, expression: hoodieExpression },
  puff: { idle: puffIdle, expression: puffExpression },
  chomper: { idle: chomperIdle, expression: chomperExpression },
};

export function residentArt(id: OriginalId): ResidentArt {
  return { ...PAIRS[id], offset: HOLO_EXPRESSION_OFFSET[id] ?? HOLO_NO_OFFSET };
}
