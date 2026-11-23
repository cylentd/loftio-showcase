// One name-pack request for a finished build (#442 P2). Total: it resolves with the checked pack or null, never throws,
// and never waits past its timeout, so a slow, failed or hostile reply costs the resident its names and nothing more.
import { parseNamePack, type NamePack } from '../../loadout/loadout-name-model.ts';
import type { NamePackProvider } from '../provider.ts';
import type { ResolvedSelections } from '../selections.ts';
import { NAME_PACK_TIMEOUT_MS } from './online-config.ts';
import { renderNamePrompt } from './name-pack-prompt.ts';

export async function requestNamePack(
  provider: NamePackProvider, resolved: ResolvedSelections, timeoutMs: number = NAME_PACK_TIMEOUT_MS, outer?: AbortSignal,
): Promise<NamePack | null> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  outer?.addEventListener('abort', stop, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => { timer = setTimeout(() => { stop(); resolve(null); }, timeoutMs); });
  try {
    const reply = await Promise.race([provider.generate({ prompt: renderNamePrompt(resolved), signal: controller.signal }), expired]);
    return parseNamePack(reply);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', stop);
  }
}
