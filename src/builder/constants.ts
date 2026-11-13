// Mock milestone limits from the accepted local-builder plan; not a deployed cost-control boundary.
export const DEFAULT_LIMITS = { sessionCap: 20, maxConcurrent: 1, technicalRetries: 1 };
// Local validation budgets chosen for preset-only requests and bounded decoded image memory.
export const REQUEST_ID_MAX_LENGTH = 64;
export const REQUEST_BODY_MAX_LENGTH = 4096;
export const IMAGE_MAX_SIDE = 4096;
export const IMAGE_MAX_BYTES = 16 * 1024 * 1024;
// Answered requestIds one generate handler instance keeps for replay, shared by every visitor it serves. A repeat
// follows its first call within minutes, so only recent ids matter. 32 is above DEFAULT_LIMITS.sessionCap and the
// online GLOBAL_DAILY_CAP, and bounds memory: each cached success holds a base64 image of up to IMAGE_MAX_BYTES.
export const RESPONSE_CACHE_MAX = 32;
// Set by the online gate on a call it let through without a cap slot because the id would replay. The generate
// handler refuses such a call when the id has been evicted meanwhile, so no provider call ever runs without a slot.
export const REPLAY_ONLY_HEADER = 'x-loftio-replay-only';
export const MOCK_SIDE = 128;
export const DATABASE_VERSION = 1;
export const DATABASE_NAME = 'loftio-builder-mock';
export const CHARACTER_STORE = 'characters';
export const LOCAL_DATABASE_NAME = 'loftio-builder-local';
export const LOCAL_API_PREFIX = '/loftio-builder-api';
export const LOCAL_POLL_INTERVAL_MS = 1500;
export const LOCAL_POLL_LIMIT = 420;
// Cloudflare Turnstile explicit-render script (developers.cloudflare.com/turnstile, client-side rendering).
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// A token normally arrives within seconds; a visible challenge needs time for a person, so allow a minute.
export const TURNSTILE_TIMEOUT_MS = 60_000;
// Online mode keeps its own browser storage, apart from mock and local.
export const ONLINE_DATABASE_NAME = 'loftio-builder-online';
export const ONLINE_REGISTRY_KEY = 'loftio-residents-online-v1';
export const ONLINE_TICKET_KEY = 'loftio-build-tickets-online-v1';
export const ONLINE_JOURNAL_KEY = 'loftio-builder-online-pending-v1';
