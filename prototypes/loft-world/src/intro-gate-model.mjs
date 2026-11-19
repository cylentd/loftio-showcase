// Decides how the opening starts. Browsers block sound until the visitor presses something, and the flyover
// should not play silent, so a blocked start turns the loading cover into one "begin" button.
export const GATE = Object.freeze({
  beginTouch: 'Tap to begin',
  beginPointer: 'Click to begin',
  ready: 'Ready when you are.',
});

/** 'prompt' = hold the cover and ask for a press; 'go' = lift the cover now. `started` is whether sound is already playing. */
export function startPlan({ hasIntro, soundOn, started }) {
  return hasIntro && soundOn && !started ? 'prompt' : 'go';
}

export const beginLabel = (coarse) => (coarse ? GATE.beginTouch : GATE.beginPointer);
