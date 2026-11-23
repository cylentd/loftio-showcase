// The phone's holo tab strip scrolls sideways (#565 QA r2). Its right edge fades only while a tab still sits off-screen
// to the right (`data-more` on the strip, storybook.css draws the fade), and a picked tab is scrolled clear of the fade,
// so the selected tab is always fully readable. A strip that fits shows no fade at all.

/** True while the strip holds more than it shows to the right of its scroll position. The 1 px slack absorbs the
 *  sub-pixel scrollLeft a zoomed or high-density screen reports at the true end. */
export const moreToRight = (scrollLeft: number, clientWidth: number, scrollWidth: number): boolean =>
  scrollLeft + clientWidth < scrollWidth - 1;

/** Watches `strip`'s scroll and size; `mark` re-reads it (after a repaint), `reveal` scrolls a picked tab into view,
 *  `stop` ends the watch. */
export function tabFade(strip: HTMLElement) {
  const mark = () => {
    if (moreToRight(strip.scrollLeft || 0, strip.clientWidth || 0, strip.scrollWidth || 0)) strip.dataset.more = '';
    else delete strip.dataset.more;
  };
  strip.addEventListener('scroll', mark, { passive: true });
  // A phone turned sideways can make the strip fit: re-read on every size change, not only on scroll.
  const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(mark) : null;
  sized?.observe(strip);
  /** The strip's scroll-padding keeps the tab out from under the fade; `nearest` leaves a tab already in view alone. */
  const reveal = (tab: HTMLElement) => {
    tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    mark();
  };
  const stop = () => { sized?.disconnect(); strip.removeEventListener('scroll', mark); };
  return { mark, reveal, stop };
}
