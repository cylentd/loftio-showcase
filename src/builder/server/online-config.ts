// Online builder contract: the public showcase's real-art path on Vercel.
// Budget (David, 2026-11-08): about $2 a day, at roughly $0.07 per medium 1024px image with two references.
export const GLOBAL_DAILY_CAP = 25;
export const VISITOR_DAILY_CAP = 3;
// A day's counters outlive the UTC day they count, then expire on their own.
export const CAP_KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

// Verified against developers.openai.com on 2026-11-08: the guide's named model and the edits default.
export const IMAGE_MODEL_DEFAULT = 'gpt-image-2.5-sunburst';
export const IMAGE_QUALITY_DEFAULT = 'medium';
export const IMAGE_SIZE = '1024x1024';
export const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// The durable caps above are the cost boundary. The per-instance handler session only guards concurrency,
// and never retries: a retried OpenAI call is a second charge.
export const ONLINE_LIMITS = { sessionCap: Number.MAX_SAFE_INTEGER, maxConcurrent: 4, technicalRetries: 0 };

// Server environment variable names. None of these values ever reaches browser code.
export const ENV = {
  openaiKey: 'OPENAI_API_KEY',
  model: 'LOFTIO_IMAGE_MODEL',
  quality: 'LOFTIO_IMAGE_QUALITY',
  redisUrl: 'UPSTASH_REDIS_REST_URL',
  redisToken: 'UPSTASH_REDIS_REST_TOKEN',
  // The names Vercel's Upstash Marketplace integration sets (seen on loftio-showcase, 2026-11-09); used when the above are unset.
  redisUrlMarketplace: 'KV_REST_API_URL',
  redisTokenMarketplace: 'KV_REST_API_TOKEN',
  turnstileSecret: 'TURNSTILE_SECRET_KEY',
  visitorSalt: 'LOFTIO_VISITOR_SALT',
} as const;

// The request body field that carries the browser's Turnstile token beside requestId and selections.
export const TURNSTILE_BODY_FIELD = 'turnstileToken';

// Atomic counters. incr returns the value after incrementing and sets the TTL; decr returns the value after.
export type CapStore = {
  incr(key: string, ttlSeconds: number): Promise<number>;
  decr(key: string): Promise<number>;
};
export type CapFailure = 'global' | 'visitor';
export type CapReservation = { ok: true; release(): Promise<void> } | { ok: false; reason: CapFailure };
export type VerifyHuman = (token: string, ip: string | null) => Promise<boolean>;
