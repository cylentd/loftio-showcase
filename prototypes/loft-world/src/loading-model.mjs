export const INITIAL_LOADING = Object.freeze({ phase: 'loading', assets: false, frame: false });
export function nextLoading(state, event) {
  if (state.phase !== 'loading') return state;
  if (event === 'error') return { ...state, phase: 'error' };
  const next = { ...state, [event]: true };
  return { ...next, phase: next.assets && next.frame ? 'ready' : 'loading' };
}
