// Copy for the expression prompt: the wording lives here, the rules it must carry are tested in
// tests/unit/builder-expression-prompt.test.ts. No franchise or character names, ever: the test checks every string.
export const EXPRESSION_PROMPT_VERSION = 'expression-v1';

export const EXPRESSION_PROMPT_BLOCKS = {
  identity: 'The attached idle image is the only reference and the sole source of this character\'s identity: keep its colours, markings, proportions, features and art style exactly.',
  framing: 'Keep the same framing, the same size and the same position as the idle image, so the two images can be swapped one for the other without the character moving.',
  expression: 'Show a happy, welcoming expression: a warm greeting face, as if glad to see a friend arrive. Change only the face and, at most, a small relaxed shift of the pose.',
  personality: 'Let this personality colour the welcome: {{personality}}.',
  background: 'Use a fully transparent background with no ground, shadow, scenery or text.',
  output: 'Generate exactly one image of this one character: not a sheet, a grid or several poses.',
} as const;

/** Order the blocks are joined in. */
export const EXPRESSION_PROMPT_ORDER = ['identity', 'framing', 'expression', 'personality', 'background', 'output'] as const;
