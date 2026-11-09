// The real art worker is used only on the host named in the uncommitted VITE_LOCAL_WORKER_HOST
// setting (.env.local), or with ?mode=local. Every other host, including public builds, uses mock mode.
export function usesLocalWorker(search: string, hostname: string, workerHost: string | undefined) {
  const mode = new URLSearchParams(search).get('mode');
  if (mode === 'local') return true;
  if (mode === 'mock') return false;
  return !!workerHost && hostname === workerHost;
}

export type BuilderMode = 'local' | 'online' | 'mock';

// Online is chosen by the build (VITE_BUILDER_MODE) only; no URL value can switch it on.
export function builderMode(search: string, hostname: string, env: { workerHost?: string; mode?: string }): BuilderMode {
  if (usesLocalWorker(search, hostname, env.workerHost)) return 'local';
  if (new URLSearchParams(search).get('mode') === 'mock') return 'mock';
  return env.mode === 'online' ? 'online' : 'mock';
}
