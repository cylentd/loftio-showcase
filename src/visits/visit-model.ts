export type VisitState = 'closed' | 'loading' | 'preview' | 'welcoming' | 'welcomed' | 'error';
export type VisitEvent = 'open' | 'loaded' | 'fail' | 'welcome' | 'saved' | 'close';
export function next(state: VisitState, event: VisitEvent): VisitState {
  if (event === 'close') return state === 'welcoming' ? state : 'closed';
  if (event === 'open' && state !== 'welcoming') return 'loading';
  if (event === 'loaded' && state === 'loading') return 'preview';
  if (event === 'fail') return state === 'welcoming' ? 'preview' : state === 'loading' ? 'error' : state;
  if (event === 'welcome' && state === 'preview') return 'welcoming';
  if (event === 'saved' && state === 'welcoming') return 'welcomed';
  return state;
}
