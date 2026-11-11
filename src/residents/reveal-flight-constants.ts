export const REVEAL_FLIGHT = {
  // Half-second lift approved in the handoff; frame bounds measured from the supplied 1280x720 clip.
  duration: 520, lift: 28, shadowHeight: 0.14, shadowOpacity: 0.35,
  ease: 'cubic-bezier(0.22, 0.68, 0.2, 1)',
  backgroundEase: 'cubic-bezier(0.4, 0, 0.2, 1)', backgroundDelay: 0.25,
  frame: { width: 1280, height: 720 },
  box: { x: 478, y: 270, width: 330, height: 346 },
} as const;
