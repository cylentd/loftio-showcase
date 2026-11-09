import { TURNSTILE_SCRIPT_URL, TURNSTILE_TIMEOUT_MS } from './constants.ts';

type Widget = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
};
type Waiter = { resolve(token: string): void; reject(error: Error): void };

/** Turnstile tokens are single use: each call runs the widget once and resets it. Invisible unless a challenge is needed.
 *  host: where a visible challenge appears. Inside a modal dialog it must be in the dialog, since the rest is inert. */
export function turnstileTokens({ siteKey, scriptUrl = TURNSTILE_SCRIPT_URL, doc = document, host = () => doc.body }: {
  siteKey: string; scriptUrl?: string; doc?: Document; host?: () => HTMLElement;
}): () => Promise<string> {
  let ready: Promise<{ api: Widget; id: string }> | null = null;
  let waiter: Waiter | null = null;
  const settle = (action: (waiting: Waiter) => void) => { const waiting = waiter; waiter = null; if (waiting) action(waiting); };

  const load = () => new Promise<{ api: Widget; id: string }>((resolve, reject) => {
    const start = () => {
      const api = (doc.defaultView as unknown as { turnstile?: Widget }).turnstile;
      if (!api) { reject(new Error('Turnstile did not load.')); return; }
      const container = doc.createElement('div');
      host().append(container);
      const id = api.render(container, {
        sitekey: siteKey, execution: 'execute', appearance: 'interaction-only',
        callback: (token: string) => settle(waiting => waiting.resolve(token)),
        'error-callback': () => settle(waiting => waiting.reject(new Error('Turnstile failed.'))),
        'expired-callback': () => settle(waiting => waiting.reject(new Error('Turnstile expired.'))),
      });
      resolve({ api, id });
    };
    const script = doc.createElement('script');
    script.src = scriptUrl; script.async = true;
    script.addEventListener('load', start, { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile script failed.')), { once: true });
    doc.head.append(script);
  });

  return async () => {
    // A failed load is not cached, so the next Create can try again.
    ready ??= load().catch(error => { ready = null; throw error; });
    const { api, id } = await ready;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => settle(waiting => waiting.reject(new Error('Turnstile timed out.'))), TURNSTILE_TIMEOUT_MS);
      const done = (finish: () => void) => { clearTimeout(timer); try { api.reset(id); } catch { /* widget already gone */ } finish(); };
      waiter = { resolve: token => done(() => resolve(token)), reject: error => done(() => reject(error)) };
      try { api.execute(id); } catch (error) { settle(waiting => waiting.reject(error as Error)); }
    });
  };
}
