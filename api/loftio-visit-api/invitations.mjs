// game/src/builder/server/online-config.ts
var CAP_KEY_TTL_SECONDS = 172800;
var ENV = {
	openaiKey: "OPENAI_API_KEY",
	model: "LOFTIO_IMAGE_MODEL",
	quality: "LOFTIO_IMAGE_QUALITY",
	redisUrl: "UPSTASH_REDIS_REST_URL",
	redisToken: "UPSTASH_REDIS_REST_TOKEN",
	redisUrlMarketplace: "KV_REST_API_URL",
	redisTokenMarketplace: "KV_REST_API_TOKEN",
	turnstileSecret: "TURNSTILE_SECRET_KEY",
	visitorSalt: "LOFTIO_VISITOR_SALT"
};
// game/src/builder/utc-day.ts
var DAY_LENGTH = 10;
/** The UTC calendar day a daily allowance or cap counts against, as "YYYY-MM-DD". */
var utcDay = (date) => date.toISOString().slice(0, DAY_LENGTH);
// game/src/builder/server/caps.ts
var BUILDER_KEY_PREFIX = "loftio:caps";
function createCaps({ store, now, globalCap = 25, visitorCap = 3, keyPrefix = BUILDER_KEY_PREFIX }) {
	async function bump(key) {
		const count = await store.incr(key, CAP_KEY_TTL_SECONDS);
		if (!Number.isInteger(count) || count < 1) throw new Error(`Cap store returned an invalid count: ${count}`);
		return count;
	}
	async function reserve(visitorKey) {
		const day = utcDay(now());
		const globalKey = `${keyPrefix}:${day}:global`;
		const visitorCounter = `${keyPrefix}:${day}:visitor:${visitorKey}`;
		if (await bump(visitorCounter) > visitorCap) {
			await store.decr(visitorCounter);
			return {
				ok: false,
				reason: "visitor"
			};
		}
		if (await bump(globalKey) > globalCap) {
			await store.decr(globalKey);
			await store.decr(visitorCounter);
			return {
				ok: false,
				reason: "global"
			};
		}
		let released = false;
		return {
			ok: true,
			async release() {
				if (released) return;
				released = true;
				await store.decr(visitorCounter);
				await store.decr(globalKey);
			}
		};
	}
	return { reserve };
}
function upstashPipeline({ url, token, fetcher = fetch }) {
	const scrub = (text) => text.split(token).join("[redacted]");
	return async (commands) => {
		const response = await fetcher(`${url}/pipeline`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(commands)
		});
		if (!response.ok) throw new Error(`Upstash request failed with status ${response.status}`);
		const entries = await response.json();
		const failed = entries.find((entry) => entry.error !== void 0);
		if (failed) throw new Error(scrub(`Upstash command failed: ${failed.error}`));
		return entries;
	};
}
function upstashStore(options) {
	const pipeline = upstashPipeline(options);
	function count(entries) {
		const result = entries[0]?.result;
		if (typeof result !== "number" || !Number.isInteger(result)) throw new Error("Upstash returned no integer count");
		return result;
	}
	return {
		async incr(key, ttlSeconds) {
			return count(await pipeline([["INCR", key], [
				"EXPIRE",
				key,
				String(ttlSeconds)
			]]));
		},
		async decr(key) {
			return count(await pipeline([["DECR", key]]));
		}
	};
}
// game/src/builder/copy.ts
var COPY$1 = {
	title: "Meet a new resident",
	intro: "Choose a few sparks of personality. Keep the ones you love.",
	mockNotice: "Mock mode · free placeholders, not AI-generated art. They do not depict your selections. Presets are provisional.",
	creature: "Inspired by",
	personality: "Personality",
	signatureDetail: "Signature detail",
	palette: "Palette",
	surprise: "Surprise me",
	choosePalette: "Let Loftio choose",
	create: "Create",
	generating: "Making one placeholder…",
	preparing: "Preparing the image…",
	revealed: "One placeholder is ready. Keep it or try another.",
	cancel: "Cancel",
	keep: "Keep",
	kept: "Kept",
	saving: "Saving…",
	another: "Try another",
	refine: "Refine",
	refineUnavailable: "Refinement is not available yet. Try another makes a new interpretation.",
	empty: "Your next resident appears here.",
	previewAlt: "Mock resident placeholder",
	gallery: "Kept residents",
	galleryEmpty: "Keep a resident to save it in this browser.",
	storageNotice: "Saved on this device only. Clearing browser data removes saved residents. Mock residents have a separate library.",
	back: "Back to the loft",
	preview: "Preview",
	transparent: "Transparent pixels verified",
	opaque: "Opaque background",
	checkerboard: "Possible baked-in checkerboard",
	margins: "Subject may be cropped or empty",
	network: "Connection lost. Your saved residents are unchanged.",
	storage: "Could not save or load residents. Browser storage may be unavailable or full.",
	corrupt: "The image could not be decoded.",
	preparation: "Your image is saved. Retry preparing its preview without creating another image.",
	invalid: "Choose a valid option in each field.",
	cap: "The mock session limit has been reached. Reload to start a new free session.",
	busy: "A generation is already in progress.",
	safety: "The image request was rejected. No automatic retry was made.",
	aborted: "Generation cancelled.",
	tickets: "You’re out of build tickets. Each new image uses one.",
	conflict: "This request ID already belongs to different selections.",
	method: "Use POST for generation.",
	human: "We couldn’t confirm you’re a person. Refresh the page and try again.",
	usage: (used, cap) => [
		used,
		"of",
		cap,
		"mock attempts this session"
	].join(" ")
};
({ ...COPY$1 });
({ ...COPY$1 });
// game/src/builder/server/online-handler.ts
var UNKNOWN_IP = "unknown";
var HEX_RADIX = 16;
function clientIp(request) {
	const real = request.headers.get("x-real-ip")?.trim();
	if (real) return real;
	return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
async function visitorKeyFor(ip, salt) {
	const bytes = new TextEncoder().encode(`${salt}:${ip ?? UNKNOWN_IP}`);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(HEX_RADIX).padStart(2, "0")).join("");
}
var INVITATION_TTL_SECONDS = 604800;
var MS_PER_SECOND = 1e3;
var CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
Math.ceil(163840 / 3) * 4;
var PNG_SIGNATURE = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
var CAP_KEY_PREFIX = "loftio:visit-links:caps";
var INVITATION_KEY_PREFIX = "loftio:visit-links:invitation";
var HTTP = {
	ok: 200,
	created: 201,
	badRequest: 400,
	notFound: 404,
	methodNotAllowed: 405,
	tooLarge: 413,
	tooMany: 429,
	unavailable: 503
};
// game/src/visits/server/copy.ts
var ERROR = {
	invalid: "invalid",
	tooLarge: "too-large",
	rateLimited: "rate-limited",
	unavailable: "unavailable",
	notFound: "not-found",
	method: "method-not-allowed"
};
// game/src/visits/constants.ts
var BASE64_TEXT = /^[A-Za-z0-9+/]*={0,2}$/;
var ANCILLARY_CHUNK_NAME = /^[a-z][A-Za-z]{3}$/;
var KIND = "loftio-visit";
// game/src/builder/png.ts
var SIGNATURE = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
var COLOR_TYPE_GREY_ALPHA = 4;
var COLOR_TYPE_RGBA = 6;
var IHDR_LENGTH = 13;
var CHUNK_OVERHEAD = 12;
var chunkType = (bytes, at) => String.fromCharCode(...bytes.subarray(at, at + 4));
function readPngInfo(bytes) {
	if (bytes.length < SIGNATURE.length + CHUNK_OVERHEAD + IHDR_LENGTH) return null;
	if (SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (chunkType(bytes, 12) !== "IHDR" || view.getUint32(8) !== IHDR_LENGTH) return null;
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	const colorType = bytes[25];
	if (!width || !height || ![
		0,
		2,
		3,
		4,
		6
	].includes(colorType ?? -1)) return null;
	let hasAlphaChannel = colorType === COLOR_TYPE_RGBA || colorType === COLOR_TYPE_GREY_ALPHA;
	let hasImageData = false;
	for (let at = SIGNATURE.length; at + CHUNK_OVERHEAD <= bytes.length;) {
		const length = view.getUint32(at);
		const end = at + CHUNK_OVERHEAD + length;
		if (end > bytes.length) return null;
		if (crc32(bytes.subarray(at + 4, end - 4)) !== view.getUint32(end - 4)) return null;
		const type = chunkType(bytes, at + 4);
		if (type === "IDAT" && length > 0) hasImageData = true;
		if (type === "IEND") return hasImageData && length === 0 && end === bytes.length ? {
			width,
			height,
			hasAlphaChannel
		} : null;
		if (type === "tRNS") hasAlphaChannel = true;
		at = end;
	}
	return null;
}
var CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
	return c >>> 0;
});
function crc32(bytes) {
	let crc = 4294967295;
	for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 255] ?? 0) ^ crc >>> 8;
	return (crc ^ 4294967295) >>> 0;
}
// game/src/visits/copy.ts
var COPY = {
	inviteName: "You can view this resident, but this name cannot be used on an invitation.",
	partial: "Some guests could not appear in the room. You can still end their visits here.",
	title: "A little visit",
	close: "Close resident viewer",
	inspect: "View resident",
	open: "Open invitation",
	guests: "Visiting your loft",
	empty: "No guests yet. Open an invitation from a friend.",
	share: "Share invitation",
	download: "Download invitation",
	welcome: "Welcome",
	cancel: "Cancel",
	notNow: "Not now",
	fileRoute: "Or send it as a file:",
	shareFile: "Share file",
	downloadFile: "Download file",
	retry: "Try again",
	done: "Close",
	opening: "Opening your invitation…",
	remove: "End visit",
	confirmRemove: "End this visit?",
	removeHelp: "This guest will leave your loft. Your own residents stay.",
	preview: "A friend invited this resident to visit your loft. Nothing is added unless you tap Welcome.",
	owned: "Send this invitation to a friend. Your resident stays here.",
	guest: "Visiting your loft until you end their visit.",
	loading: "Opening artwork…",
	saving: "Welcoming…",
	welcomed: "Your guest is in the loft.",
	duplicate: "This guest is already in your loft.",
	shared: "Invitation handed to your share app.",
	downloaded: "Download requested. Send the invitation file to your friend.",
	cancelled: "Sharing cancelled.",
	invalid: "This is not a supported Loftio invitation.",
	large: "This invitation is too large.",
	unsupported: "This artwork cannot be shared yet. Choose a finished painted resident.",
	storage: "The visit could not be saved. Check your browser storage and try again.",
	load: "Saved guests could not be restored. Reload to try again.",
	capacity: "Your loft has four guests. End a visit before welcoming another.",
	shareFailed: "Sharing was unavailable. You can download the invitation instead.",
	failed: "The artwork could not be opened. Your loft has not changed."
};
// game/src/visits/invite-contract.ts
var bytesFromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
var base64FromBytes = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
function displayName(value) {
	if (typeof value !== "string") throw Error(COPY.invalid);
	const name = value.normalize("NFC").trim();
	if (!name || [...name].length > 40 || !/^[\p{L}\p{M}\p{N} .'’\-]+$/u.test(name)) throw Error(COPY.invalid);
	return name;
}
function parseInvitation(text) {
	if (text.length > 2097152 || new TextEncoder().encode(text).length > 2097152) throw Error(COPY.large);
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw Error(COPY.invalid);
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(COPY.invalid);
	const row = value;
	if (Object.keys(row).sort().join(",") !== "kind,name,png,version" || row.kind !== "loftio-visit" || row.version !== 1 || typeof row.png !== "string" || row.png.length % 4 !== 0 || !BASE64_TEXT.test(row.png)) throw Error(COPY.invalid);
	const png = cleanPng(bytesFromBase64(row.png));
	return {
		kind: KIND,
		version: 1,
		name: displayName(row.name),
		png: base64FromBytes(png)
	};
}
/** Validate the full chunk/CRC structure and dimensions before any image decoder sees bytes.
* Only static RGBA8 is portable. Strip every ancillary chunk (including text, EXIF and profiles). */
function cleanPng(bytes) {
	if (bytes.length > 1048576) throw Error(COPY.large);
	const info = readPngInfo(bytes);
	if (!info || info.width > 2048 || info.height > 2048 || bytes[24] !== 8 || bytes[25] !== 6 || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw Error(COPY.invalid);
	const parts = [bytes.slice(0, 8)];
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let dataEnded = false, seenData = false;
	for (let at = 8; at < bytes.length;) {
		const length = view.getUint32(at), end = at + length + 12;
		const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
		if (type === "acTL" || type === "fcTL" || type === "fdAT" || type === "IHDR" && at !== 8) throw Error(COPY.invalid);
		if (type === "IDAT") {
			if (dataEnded) throw Error(COPY.invalid);
			seenData = true;
		} else if (seenData) dataEnded = true;
		if ([
			"IHDR",
			"IDAT",
			"IEND"
		].includes(type)) parts.push(bytes.slice(at, end));
		else if (!ANCILLARY_CHUNK_NAME.test(type)) throw Error(COPY.invalid);
		at = end;
	}
	const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
	parts.reduce((at, part) => {
		out.set(part, at);
		return at + part.length;
	}, 0);
	return out;
}
// game/src/visits/server/handler.ts
var respond = (status, body) => Response.json(body, {
	status,
	headers: { "Cache-Control": "no-store" }
});
var fail = (status, error) => respond(status, { error });
var notFound = () => fail(HTTP.notFound, ERROR.notFound);
/** 22 base64url characters of 16 random bytes: 128 bits, so a code cannot be guessed. */
function randomCode() {
	return base64FromBytes(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodedLength(base64) {
	const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	return base64.length / 4 * 3 - padding;
}
/** Reads width and height from the PNG header in the first base64 characters, so a huge picture is refused unseen. */
function headerTooBig(png) {
	const head = png.slice(0, 32);
	if (head.length < 32 || !BASE64_TEXT.test(head)) return false;
	const bytes = bytesFromBase64(head);
	if (PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return false;
	const view = new DataView(bytes.buffer);
	return view.getUint32(16) > 512 || view.getUint32(20) > 512;
}
/** Size first (from text and header, before any decode), then the full contract check; canonical form out. */
function checkInvitation(text) {
	const tooLarge = {
		status: HTTP.tooLarge,
		error: ERROR.tooLarge
	};
	if (text.length > 219480) return tooLarge;
	let png;
	try {
		png = JSON.parse(text)?.png;
	} catch {
		return {
			status: HTTP.badRequest,
			error: ERROR.invalid
		};
	}
	if (typeof png === "string" && (png.length > 218456 || headerTooBig(png))) return tooLarge;
	let invitation;
	try {
		invitation = parseInvitation(text);
	} catch {
		return {
			status: HTTP.badRequest,
			error: ERROR.invalid
		};
	}
	return decodedLength(invitation.png) > 163840 ? tooLarge : { invitation };
}
function createVisitHandler(options) {
	const { store, now, visitorKey, newCode = randomCode } = options;
	const caps = createCaps({
		store: options.counters,
		now,
		keyPrefix: CAP_KEY_PREFIX,
		visitorCap: options.visitorCap ?? 5,
		globalCap: options.globalCap ?? 60
	});
	async function create(request) {
		const checked = checkInvitation(await request.text());
		if ("error" in checked) return fail(checked.status, checked.error);
		let reservation;
		try {
			reservation = await caps.reserve(await visitorKey(clientIp(request)));
		} catch {
			return fail(HTTP.unavailable, ERROR.unavailable);
		}
		if (!reservation.ok) return fail(HTTP.tooMany, ERROR.rateLimited);
		const code = newCode();
		try {
			await store.put(code, JSON.stringify(checked.invitation), INVITATION_TTL_SECONDS);
		} catch {
			await reservation.release().catch(() => {});
			return fail(HTTP.unavailable, ERROR.unavailable);
		}
		const expiresAt = new Date(now().getTime() + INVITATION_TTL_SECONDS * MS_PER_SECOND).toISOString();
		return respond(HTTP.created, {
			code,
			expiresAt
		});
	}
	async function read(request) {
		const code = new URL(request.url).searchParams.get("code") ?? "";
		if (!CODE_PATTERN.test(code)) return notFound();
		let text;
		try {
			text = await store.get(code);
		} catch {
			return fail(HTTP.unavailable, ERROR.unavailable);
		}
		if (text === null) return notFound();
		try {
			return respond(HTTP.ok, parseInvitation(text));
		} catch {
			return notFound();
		}
	}
	return async function handle(request) {
		if (request.method === "POST") return create(request);
		if (request.method === "GET") return read(request);
		return fail(HTTP.methodNotAllowed, ERROR.method);
	};
}
// game/src/visits/server/store.ts
var keyFor = (code) => `${INVITATION_KEY_PREFIX}:${code}`;
function upstashInvitationStore(options) {
	const pipeline = upstashPipeline(options);
	return {
		async put(code, value, ttlSeconds) {
			await pipeline([[
				"SET",
				keyFor(code),
				value,
				"EX",
				String(ttlSeconds)
			]]);
		},
		async get(code) {
			const result = (await pipeline([["GET", keyFor(code)]]))[0]?.result;
			if (result === null || result === void 0) return null;
			if (typeof result !== "string") throw new Error("Upstash returned a non-text invitation");
			return result;
		}
	};
}
// game/src/visits/server/vercel-entry.ts
var nodeProcess = globalThis.process;
var REQUIRED_ENV = [
	ENV.redisUrl,
	ENV.redisToken,
	ENV.visitorSalt
];
var unconfigured = () => Response.json({ error: ERROR.unavailable }, {
	status: HTTP.unavailable,
	headers: { "Cache-Control": "no-store" }
});
var liveFetch = (...args) => fetch(...args);
var withMarketplaceNames = (env) => ({
	...env,
	[ENV.redisUrl]: env[ENV.redisUrl] || env[ENV.redisUrlMarketplace],
	[ENV.redisToken]: env[ENV.redisToken] || env[ENV.redisTokenMarketplace]
});
function createVisitVercelHandler(given) {
	const env = withMarketplaceNames(given);
	if (REQUIRED_ENV.some((name) => !env[name])) return async () => unconfigured();
	const redis = {
		url: env[ENV.redisUrl],
		token: env[ENV.redisToken],
		fetcher: liveFetch
	};
	const salt = env[ENV.visitorSalt];
	return createVisitHandler({
		store: upstashInvitationStore(redis),
		counters: upstashStore(redis),
		visitorKey: (ip) => visitorKeyFor(ip, salt),
		now: () => /* @__PURE__ */ new Date()
	});
}
var handler;
var handle = (request) => (handler ??= createVisitVercelHandler(nodeProcess.env))(request);
var GET = handle;
var POST = handle;
export { GET, POST, createVisitVercelHandler };
