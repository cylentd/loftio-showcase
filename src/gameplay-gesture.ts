/**
 * Keep a two-finger pinch from zooming the page in while the game surface is touched.
 * Only the surface it is given is guarded, so modals, sliders and text elsewhere keep browser zoom and scrolling.
 * One finger is left alone, and so is every gesture while the page is already zoomed in (`pageScale` above 1), so the person can pinch back out.
 * Returns a function that removes the guard.
 */
export function guardPinch(surface: EventTarget, pageScale: () => number = () => 1): () => void {
  const block = (event: Event) => { if (event.cancelable && pageScale() <= 1) event.preventDefault(); };
  const move = (event: Event) => { if (((event as TouchEvent).touches?.length ?? 0) > 1) block(event); };
  const options = { passive: false } as const;
  surface.addEventListener("touchmove", move, options);
  surface.addEventListener("gesturestart", block, options);
  surface.addEventListener("gesturechange", block, options);
  return () => {
    surface.removeEventListener("touchmove", move);
    surface.removeEventListener("gesturestart", block);
    surface.removeEventListener("gesturechange", block);
  };
}
