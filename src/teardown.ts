/** One disposal step: cancels a timer, removes a listener, ends a run. Safe to call when its work is already done. */
export type Teardown = () => void;

/** What a room feature hands back. Its teardown is optional, so a feature with nothing to release names none. */
type FeatureHandle = { teardown?: Teardown } | void;

/**
 * One function that runs every hook in order, once. A missing hook is skipped. A hook that throws is reported and
 * the rest still run, because one stuck disposal must not leave the others live. A second call does nothing.
 */
export function teardownAll(hooks: readonly (Teardown | undefined)[]): Teardown {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const hook of hooks) {
      try { hook?.(); } catch (error) { console.error(error); }
    }
  };
}

/** The room's teardown: each installed feature's hook, then the room's own hooks (installed earlier, so released last). */
export function roomTeardown(installed: readonly FeatureHandle[], ...own: readonly Teardown[]): Teardown {
  return teardownAll([...installed.map(feature => feature?.teardown), ...own]);
}

/**
 * Runs `teardown` when the page is leaving for good. A page that goes into the back-forward cache (`persisted`) can
 * come back alive, so it keeps everything.
 */
export function onPageExit(teardown: Teardown, target: EventTarget = globalThis): void {
  target.addEventListener('pagehide', event => { if (!(event as PageTransitionEvent).persisted) teardown(); });
}
