import { LINK_CODE, LINK_FLAG, LINK_PARAM } from './constants';

/** Links are offered by a build that sets VITE_VISIT_LINKS=online, or by an installer that asks for them outright
 * (the showcase, the one build that deploys the endpoint). No URL value turns them on. */
export const linksEnabled = (flag: string | undefined, hosted = false) => hosted || flag === LINK_FLAG;

type Place = { pathname: string; search: string; hash: string };
type Replacer = { replaceState(state: unknown, title: string, url?: string | URL | null): void };

/** Read `?visit=<code>` once and remove it from the address bar so a reload does not fetch again.
 * Returns the code only when it is well formed; a malformed one is dropped without a request.
 * With links off the URL is left alone. */
export function takeVisitCode(enabled: boolean, place: Place, history: Replacer): string | null {
  if (!enabled) return null;
  const params = new URLSearchParams(place.search);
  if (!params.has(LINK_PARAM)) return null;
  const code = params.get(LINK_PARAM) ?? '';
  params.delete(LINK_PARAM);
  const rest = params.toString();
  history.replaceState(null, '', place.pathname + (rest ? '?' + rest : '') + place.hash);
  return LINK_CODE.test(code) ? code : null;
}
