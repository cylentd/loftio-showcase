import type { BuilderMode } from '../builder/local-mode';
import type { Teardown } from '../teardown';

type Reconnecting = { reconnect(): Promise<unknown>; state(): { status: string } };

/**
 * The residents panel's page-level listeners: back online or tab visible (reconnect the builder), another tab spent
 * or added a ticket (refresh the count), and, online, leaving mid-build (the image arrives through this page and the
 * ticket is already spent, so ask first). Returns the one call that removes all of them.
 */
export function bindSessionEvents(opts: { builder: Reconnecting; mode: BuilderMode; ticketKey: string; onTicketChange: () => void }): Teardown {
  const stop = new AbortController();
  const { signal } = stop;
  const reconnect = () => { void opts.builder.reconnect(); };
  addEventListener('online', reconnect, { signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnect(); }, { signal });
  if (opts.mode === 'online') addEventListener('beforeunload', event => { if (opts.builder.state().status === 'generating') event.preventDefault(); }, { signal });
  addEventListener('storage', event => { if (event.key === opts.ticketKey) opts.onTicketChange(); }, { signal });
  return () => stop.abort();
}
