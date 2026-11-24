import { COPY } from './copy.ts';
import { ProviderError } from './provider.ts';

export type ExclusiveWrite = <Result>(work: () => Result) => Promise<Result>;
export type AltOperation = <Result>(savedId: string, work: () => Promise<Result>) => Promise<Result | 'busy'>;
const LOCK_NAME = 'loftio-online-builder-v1';
const ALT_LOCK_PREFIX = 'loftio-online-manual-alt-v1:';

export function onlineWrite(locks?: LockManager): ExclusiveWrite {
  return async work => {
    if (!locks || typeof locks.request !== 'function') throw new ProviderError('storage', COPY.lockUnavailable);
    return locks.request(LOCK_NAME, { mode: 'exclusive' }, work);
  };
}

export function onlineAltOperation(locks?: LockManager): AltOperation {
  return async (savedId, work) => {
    if (!locks || typeof locks.request !== 'function') throw new ProviderError('storage', COPY.lockUnavailable);
    return locks.request(ALT_LOCK_PREFIX + savedId, { mode: 'exclusive', ifAvailable: true }, async lock => lock ? await work() : 'busy' as const);
  };
}
