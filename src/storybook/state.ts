// G15, the storybook page (#565): one pure transition over the book's lifecycle. Every refusal returns the same state
// object, so a caller tells "refused" by identity. Table: game/tests/unit/storybook-state.test.ts.

export type StorybookState =
  | { kind: 'closed' }
  | { kind: 'opening' }
  | { kind: 'open'; spread: number; zoom: string | null }
  | { kind: 'turning'; from: number; to: number }
  | { kind: 'closing'; spread: number };

/** `resize`: the pages per view went from `was` to `perView`; `pages` is the page count, so the spread can be clamped. */
export type StorybookEvent =
  | { type: 'open' } | { type: 'opened' }
  | { type: 'turn'; dir: 1 | -1; spreadCount: number } | { type: 'turned' }
  | { type: 'zoom'; id: string } | { type: 'unzoom' }
  | { type: 'close' } | { type: 'closed' }
  | { type: 'resize'; was: number; perView: number; pages: number };

/** The spread that holds `page` at `perView` pages per spread, clamped into the book. */
function spreadOf(page: number, perView: number, pages: number): number {
  const last = Math.max(0, Math.ceil(pages / perView) - 1);
  return Math.min(last, Math.floor(page / perView));
}

function fromOpen(state: Extract<StorybookState, { kind: 'open' }>, event: StorybookEvent): StorybookState {
  switch (event.type) {
    case 'turn': {
      const to = state.spread + event.dir;
      return state.zoom !== null || to < 0 || to >= event.spreadCount ? state : { kind: 'turning', from: state.spread, to };
    }
    case 'zoom': return state.zoom === null ? { ...state, zoom: event.id } : state;
    case 'unzoom': return state.zoom === null ? state : { ...state, zoom: null };
    case 'close': return state.zoom === null ? { kind: 'closing', spread: state.spread } : state;
    case 'resize': return { ...state, spread: spreadOf(state.spread * event.was, event.perView, event.pages) };
    default: return state;
  }
}

export function nextStorybook(state: StorybookState, event: StorybookEvent): StorybookState {
  switch (state.kind) {
    case 'closed': return event.type === 'open' ? { kind: 'opening' } : state;
    case 'opening':
      if (event.type === 'opened') return { kind: 'open', spread: 0, zoom: null };
      return event.type === 'close' ? { kind: 'closing', spread: 0 } : state;
    case 'open': return fromOpen(state, event);
    case 'turning':
      if (event.type === 'turned') return { kind: 'open', spread: state.to, zoom: null };
      return event.type === 'close' ? { kind: 'closing', spread: state.to } : state;
    case 'closing': return event.type === 'closed' ? { kind: 'closed' } : state;
  }
}

/** The closed book's open cue (S3). `shown` is the page's `data-state`: S2 shows G15 `opening` as the closed book
 *  (`closed`) until the first tap, ArrowRight or swipe starts the cover swinging (`opening`). The cue runs only then:
 *  a slow lift of the fore-edge (`peek`), or the cover held ajar under reduced motion (`ajar`). */
export function coverCue(state: StorybookState, shown: string | undefined, reduced: boolean): 'peek' | 'ajar' | null {
  if (state.kind !== 'opening' || shown !== 'closed') return null;
  return reduced ? 'ajar' : 'peek';
}
