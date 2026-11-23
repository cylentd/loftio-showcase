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

// The name pack (#442 P2): one small text call after each image, inside the same cap slot, never retried.
// No default model: no current source confirmed a text-model id (checked 2026-11-19), so LOFTIO_NAME_MODEL must name one
// the account can use. Unset or empty means no name request at all, never a guess. A wrong id only means no names.
export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
// Twenty-one names of at most 24 characters, as JSON, is about 600 characters; four times that leaves room for ids.
export const NAME_PACK_MAX_TOKENS = 600;
// A reply past this many characters is not a name pack and is dropped before it is parsed.
export const NAME_PACK_MAX_REPLY_CHARS = 4096;
// The image call needs most of the function limit (FUNCTION_MAX_DURATION_MS); the names get a small slice so a slow one cannot eat the build.
export const NAME_PACK_TIMEOUT_MS = 15_000;

// Vercel Functions limits, read on 2026-11-19 from https://vercel.com/docs/functions/limitations:
// "Hobby: 300s default and maximum", and "The maximum payload size for the request body or the response body of a Vercel
// Function is 4.5 MB" (a 413 FUNCTION_PAYLOAD_TOO_LARGE past it). The page says "MB" without a unit base, so it is read as the
// lower decimal value.
export const FUNCTION_MAX_DURATION_MS = 300_000;
export const PLATFORM_BODY_LIMIT_BYTES = 4_500_000;

// An expression reply is checked on its encoded (base64) length, the size that travels. The platform's body limit minus a margin
// for the JSON around the image (ids, mime, size fields, headers), so a reply under this never meets the platform's 413.
const RESPONSE_MARGIN_BYTES = 500_000;
export const ONLINE_RESPONSE_MAX_BYTES = PLATFORM_BODY_LIMIT_BYTES - RESPONSE_MARGIN_BYTES;

// The follow-up token (docs/architecture/BUILDER-FOLLOW-UPS.md, "Online"): one use, bound to one build.
// TTL: from the moment the build answers. The browser follows up at once; a full function duration also covers a tab that waited.
export const FOLLOW_UP_TOKEN_TTL_MS = FUNCTION_MAX_DURATION_MS;
// Deadline: counted from the build's start, while the TTL counts from the token's issue, so the two differ by the build's own
// length. The slowest build the platform allows runs the whole function duration, and its name pack then takes up to
// NAME_PACK_TIMEOUT_MS, so a follow-up asked right after it still starts. The deadline is the larger number, but a slow build
// can reach it before its token expires: a token issued late in a long build is refused as late (504) inside its TTL.
// The alt (the second follow-up) is asked after the expression ends, so it can start past this deadline and be refused (504); it is
// then failed('network') alone. Not measured: the real expression and alt draw times need live calls (alt-art plan, "Online limits"),
// so the value is unchanged until they are measured. Likewise not measured: the encoded sizes of an opaque alt and of an
// idle + expression body against PLATFORM_BODY_LIMIT_BYTES and ONLINE_RESPONSE_MAX_BYTES.
export const FOLLOW_UP_START_DEADLINE_MS = FUNCTION_MAX_DURATION_MS + NAME_PACK_TIMEOUT_MS;
// The token lives in the shared Redis (below), so a follow-up on another function instance redeems it. The handler checks the exact
// expiry on its own clock; the store keeps the key a little longer so it never expires first and shifts that boundary.
export const FOLLOW_UP_STORE_MARGIN_MS = 5_000;
export const FOLLOW_UP_KEY_PREFIX = 'loftio:follow-up:';

// A follow-up body carries the idle as base64, so it has its own cap beside REQUEST_BODY_MAX_LENGTH. It is the platform's request
// body limit (PLATFORM_BODY_LIMIT_BYTES, cited above): the handler never parses more than the platform can deliver. The JSON
// around the idle (token, id, field names) takes FOLLOW_UP_BODY_OVERHEAD_CHARS of it; the rest is the largest idle's base64.
const FOLLOW_UP_BODY_OVERHEAD_CHARS = 1024;
export const FOLLOW_UP_BODY_MAX_LENGTH = PLATFORM_BODY_LIMIT_BYTES;
export const FOLLOW_UP_IDLE_MAX_LENGTH = FOLLOW_UP_BODY_MAX_LENGTH - FOLLOW_UP_BODY_OVERHEAD_CHARS;

// The durable caps above are the cost boundary. The per-instance handler session only guards concurrency,
// and never retries: a retried OpenAI call is a second charge.
export const ONLINE_LIMITS = { sessionCap: Number.MAX_SAFE_INTEGER, maxConcurrent: 4, technicalRetries: 0 };

// Server environment variable names. None of these values ever reaches browser code.
export const ENV = {
  openaiKey: 'OPENAI_API_KEY',
  model: 'LOFTIO_IMAGE_MODEL',
  quality: 'LOFTIO_IMAGE_QUALITY',
  nameModel: 'LOFTIO_NAME_MODEL',
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
// The follow-up tokens' store, shared by every function instance. setNX writes once (false when the key exists), with a lifetime;
// getDel is the atomic one-time take: it returns the value and removes it, so of two redeems only one gets a value.
// The Upstash Redis behind it is the one the caps use; the characters' in-memory KeyValuePort fits this type for tests.
export type TokenStore = {
  setNX(key: string, value: string, ttlMs: number): Promise<boolean>;
  getDel(key: string): Promise<string | null>;
};
export type CapFailure = 'global' | 'visitor';
export type CapReservation = { ok: true; release(): Promise<void> } | { ok: false; reason: CapFailure };
export type VerifyHuman = (token: string, ip: string | null) => Promise<boolean>;
