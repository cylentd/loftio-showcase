import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
// .claude/worktrees/showcase-export-2/game/src/builder/server/online-config.ts
var CAP_KEY_TTL_SECONDS = 172800;
var IMAGE_SIZE = "1024x1024";
var OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
var TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var ONLINE_LIMITS = {
	sessionCap: Number.MAX_SAFE_INTEGER,
	maxConcurrent: 4,
	technicalRetries: 0
};
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
// .claude/worktrees/showcase-export-2/game/src/builder/utc-day.ts
var DAY_LENGTH = 10;
/** The UTC calendar day a daily allowance or cap counts against, as "YYYY-MM-DD". */
var utcDay = (date) => date.toISOString().slice(0, DAY_LENGTH);
// .claude/worktrees/showcase-export-2/game/src/builder/server/caps.ts
function createCaps({ store, now, globalCap = 25, visitorCap = 3 }) {
	async function bump(key) {
		const count = await store.incr(key, CAP_KEY_TTL_SECONDS);
		if (!Number.isInteger(count) || count < 1) throw new Error(`Cap store returned an invalid count: ${count}`);
		return count;
	}
	async function reserve(visitorKey) {
		const day = utcDay(now());
		const globalKey = `loftio:caps:${day}:global`;
		const visitorCounter = `loftio:caps:${day}:visitor:${visitorKey}`;
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
function upstashStore({ url, token, fetcher = fetch }) {
	const scrub = (text) => text.split(token).join("[redacted]");
	async function pipeline(commands) {
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
	}
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
// .claude/worktrees/showcase-export-2/game/src/builder/provider.ts
var ProviderError = class extends Error {
	kind;
	constructor(kind, message) {
		super(message);
		this.name = "ProviderError";
		this.kind = kind;
	}
};
var option = (id, label, prompt) => ({
	id,
	label,
	prompt
});
var palette = (id, label, colors) => ({
	id,
	label,
	prompt: colors.join(", "),
	colors
});
var CATALOG = {
	creatures: [
		option("moth", "Moth", "moth"),
		option("snail", "Snail", "snail"),
		option("teapot", "Teapot", "teapot"),
		option("frog", "Frog", "frog"),
		option("crystal", "Crystal creature", "crystal creature"),
		option("mushroom", "Mushroom", "mushroom"),
		option("gecko", "Gecko", "gecko"),
		option("beetle", "Beetle", "beetle"),
		option("cloud", "Cloud", "cloud"),
		option("cat", "Cat", "cat"),
		option("puppy", "Puppy", "puppy"),
		option("bunny", "Bunny", "bunny"),
		option("fox", "Fox", "fox"),
		option("bear", "Bear", "bear"),
		option("duck", "Duck", "duck"),
		option("penguin", "Penguin", "penguin"),
		option("axolotl", "Axolotl", "axolotl"),
		option("tiny-dragon", "Dragon", "tiny friendly dragon"),
		option("sprout", "Sprout", "small plant sprout"),
		option("little-ghost", "Ghost", "small friendly ghost")
	],
	personalities: [
		option("bookworm", "Bookish", "enthusiastic bookworm"),
		option("curious", "Curious", "fearlessly curious"),
		option("serious", "Grumpy", "comically serious"),
		option("bashful", "Shy", "bashful sweetheart"),
		option("mischievous", "Cheeky", "quietly mischievous"),
		option("sleepy", "Sleepy", "sleepy dreamer"),
		option("helper", "Cheerful helper", "cheerful helper"),
		option("troublemaker", "Tiny troublemaker", "tiny troublemaker"),
		option("gentle", "Gentle giant", "gentle giant"),
		option("playful", "Playful", "playful"),
		option("affectionate", "Affectionate", "affectionate"),
		option("calm", "Calm", "calm")
	],
	signatureDetails: [
		option("reading-glasses", "Reading glasses", "oversized reading glasses"),
		option("beret", "Hat", "tilted beret"),
		option("bow-tie", "Tiny bow tie", "tiny bow tie"),
		option("fang", "Little fang", "little fang"),
		option("tuft", "Curled tuft", "curled tuft"),
		option("mittens", "Oversized mittens", "oversized mittens"),
		option("antennae", "Unusual antennae", "unusual antennae"),
		option("scarf", "Scarf", "cozy knitted scarf"),
		option("none", "None", "no accessories or added signature details"),
		option("round-glasses", "Glasses", "round glasses"),
		option("tiny-bow", "Bow", "tiny bow"),
		option("sweater", "Oversized sweater", "oversized knitted sweater"),
		option("flower-tuft", "Flowers", "a small flower tuft")
	],
	palettes: [
		palette("blackberry", "Berry", [
			"blackberry purple",
			"warm cream",
			"honey gold"
		]),
		palette("apricot", "Peach", [
			"apricot",
			"moss green",
			"honey gold"
		]),
		palette("dusty-blue", "Sky", [
			"dusty blue",
			"cream",
			"copper"
		]),
		palette("cocoa", "Cocoa", [
			"warm ivory",
			"cocoa",
			"muted coral"
		]),
		palette("frost", "Frosty", [
			"lavender",
			"icy teal",
			"cream"
		]),
		palette("meadow", "Meadow", [
			"sage green",
			"butter yellow",
			"terracotta"
		])
	]
};
// .claude/worktrees/showcase-export-2/game/src/builder/surprise-data.ts
var CREATIVE_SURPRISE = {
	creature: {
		id: "invented-creature",
		label: "Original creature",
		prompt: "Invent an original creature or whimsical object-inspired companion beyond the preset catalog. Respect all explicit selections; make one coherent, lovable Loftio resident, not an existing named character."
	},
	personality: {
		id: "invented-personality",
		label: "Original personality",
		prompt: "Invent a distinctive personality beyond the preset moods. Respect all explicit selections, including a deliberately absent accessory; convey personality through expression, pose and form."
	},
	signatureDetail: {
		id: "invented-detail",
		label: "Original detail",
		prompt: "Invent an unexpected signature detail beyond the preset accessories. Respect all explicit selections and integrate the detail into the character; no held objects or scenery."
	}
};
// .claude/worktrees/showcase-export-2/game/src/builder/selections.ts
var GROUPS = {
	creature: CATALOG.creatures,
	personality: CATALOG.personalities,
	signatureDetail: CATALOG.signatureDetails
};
var known = (group, id) => typeof id === "string" && (id === "surprise" || group.some((option) => option.id === id));
function validateSelections(input) {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return {
		ok: false,
		errors: [
			"creature",
			"personality",
			"signatureDetail",
			"palette"
		]
	};
	const body = input;
	const errors = [];
	for (const field of Object.keys(GROUPS)) if (!known(GROUPS[field], body[field])) errors.push(field);
	if (!(body.palette === null || typeof body.palette === "string" && CATALOG.palettes.some((p) => p.id === body.palette))) errors.push("palette");
	if (errors.length) return {
		ok: false,
		errors
	};
	const { creature, personality, signatureDetail, palette } = body;
	return {
		ok: true,
		value: {
			creature,
			personality,
			signatureDetail,
			palette
		}
	};
}
function pick(group, id, rng) {
	const chosen = id === null || id === "surprise" ? group[Math.min(group.length - 1, Math.floor(rng() * group.length))] : group.find((o) => o.id === id);
	if (!chosen) throw new Error(`unknown catalog id: ${id}`);
	return chosen;
}
/** Call only on validated selections. Palette omission retains its automatic catalog choice. */
function resolveSelections(selections, rng) {
	return {
		creature: selections.creature === "surprise" ? CREATIVE_SURPRISE.creature : pick(CATALOG.creatures, selections.creature, rng),
		personality: selections.personality === "surprise" ? CREATIVE_SURPRISE.personality : pick(CATALOG.personalities, selections.personality, rng),
		signatureDetail: selections.signatureDetail === "surprise" ? CREATIVE_SURPRISE.signatureDetail : pick(CATALOG.signatureDetails, selections.signatureDetail, rng),
		palette: pick(CATALOG.palettes, selections.palette, rng)
	};
}
// .claude/worktrees/showcase-export-2/game/src/builder/prompt-template.ts
var PROMPT_TEMPLATE = `# Loftio Character Builder — Runtime Image Prompt v4.2

Create **one** original resident for Loftio, a cozy, whimsical world of lovable collectible creatures.

## User's creative selections

- Creature / inspiration: {{creature}}
- Personality: {{personality}}
- Signature detail: {{signature_detail}}
- Color palette: {{resolved_palette}}

Interpret these selections creatively. They express intent, not anatomical assembly instructions. When a selection asks you to invent, decide that trait yourself beyond the preset catalog while preserving every explicit selection. The style references and image requirements still apply.

Create a whimsical companion inspired by the creature, not a realistic animal made cute. Simplify biological anatomy and surface detail. Tactile craftsmanship should support appealing forms, not dominate them with realistic skin, fur, or anatomical detail.

## Creative priority

**Lovable first → belongs in Loftio → distinctive as an individual.** Invent one appealing, coherent character with a recognizable silhouette and personality. The signature detail should feel integral to the character, not pasted onto an existing template. Personality should inform the body, pose, face, energy and details, not only a smile.

Design creature-appropriate anatomy, proportions, eyes, mouth, materials, and posture together. Do not reuse a single default oval-eye/blush/open-mouth face for all characters; do not distort the face merely to be unusual. Big eyes, small eyes, no limbs, tiny feet, asymmetric forms and simple expressions are all acceptable when they enhance the design. Anatomy may be abstract rather than biologically realistic.

## World & craftsmanship

Match the supplied Loftio visual references in **warm charm, polished softly dimensional rendering, tactile material craftsmanship, legible shapes and inviting lighting**. Materials are chosen to fit the creature: plush, wool, felt, fabric, ceramic, jelly, stone, crystal, and other suitable surfaces. Not every resident must be plush, dressed, symmetrical, or heavily decorated. Design should remain readable at small on-screen sizes.

Use the **original-six sheet as a world/style reference** and the **exploratory sheet as a range-of-possibilities reference**. Do not reproduce their specific faces, body recipes, silhouettes, motifs, costumes or named characters. Do not interpret the references as a set of rigid parts to assemble.

## Image and pose requirements

- Output **one** complete **default idle** resident, not a concept comparison or activity scene.
- Near-front or gentle three-quarter view; face clearly visible; gaze slightly upward toward viewer when anatomically appropriate.
- Compact relaxed/resting silhouette suitable for gentle bobbing or idle motion; limbs optional.
- No held objects, tools or books, even if personality suggests an activity.
- Exactly one character; no companions, text, labels, decorative floating symbols, or scenery.
- Square composition, full body visible, comfortable margins, around 80% canvas height.
- **Genuine transparent alpha background**, no floor, backdrop or cast shadow. Do not render a checkerboard pattern.

## Final instruction

Create a delightful, original Loftio resident that someone would want as their own companion. Favor emotional appeal and cohesive individuality over mechanical novelty. **Generate exactly one character image.**
`;
// .claude/worktrees/showcase-export-2/game/src/builder/prompt.ts
var PROMPT_VERSION = "v4.2";
var REFERENCE_IDS = [{
	id: "loftio-original-six",
	role: "style",
	file: "loftio-original-six.png"
}, {
	id: "loftio-exploratory-concepts",
	role: "range",
	file: "loftio-exploratory-concepts.png"
}].map((reference) => reference.id);
/** Fills the template. Values come from the catalog, never from user text, so no escaping is needed yet. */
function renderPrompt(resolved) {
	const slots = {
		creature: resolved.creature.prompt,
		personality: resolved.personality.prompt,
		signature_detail: resolved.signatureDetail.prompt,
		resolved_palette: resolved.palette.prompt
	};
	return PROMPT_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (match, name) => slots[name] ?? match);
}
// .claude/worktrees/showcase-export-2/game/src/builder/png.ts
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
var REPLAY_ONLY_HEADER = "x-loftio-replay-only";
// .claude/worktrees/showcase-export-2/game/src/builder/copy.ts
var COPY = {
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
({ ...COPY });
({ ...COPY });
// .claude/worktrees/showcase-export-2/game/src/builder/server/generate-handler.ts
var failure$1 = (status, kind, message) => Response.json({
	ok: false,
	error: {
		kind,
		message
	}
}, {
	status,
	headers: { "Cache-Control": "no-store" }
});
async function abortable(provider, request) {
	const signal = request.signal;
	if (signal?.aborted) throw new ProviderError("aborted", COPY.aborted);
	let onAbort = () => {};
	const cancelled = new Promise((_resolve, reject) => {
		onAbort = () => reject(new ProviderError("aborted", COPY.aborted));
		signal?.addEventListener("abort", onAbort, { once: true });
	});
	try {
		return await Promise.race([provider.generate(request), cancelled]);
	} finally {
		signal?.removeEventListener("abort", onAbort);
	}
}
var HTTP_BAD_GATEWAY$1 = 502;
var HTTP_CONFLICT = 409;
var HTTP_UNPROCESSABLE = 422;
var HTTP_CLIENT_CLOSED = 499;
var UNCACHED_STATUSES = [HTTP_BAD_GATEWAY$1, HTTP_CLIENT_CLOSED];
var GenerateSession = class {
	options;
	used = 0;
	concurrent = 0;
	cache = /* @__PURE__ */ new Map();
	constructor(options) {
		this.options = options;
	}
	async generate(requestId, selections, signal) {
		const resolvedSelections = resolveSelections(selections, this.options.rng);
		const prompt = renderPrompt(resolvedSelections);
		let attempts = 0;
		while (this.used < this.options.limits.sessionCap) {
			if (signal.aborted) return failure$1(HTTP_CLIENT_CLOSED, "aborted", COPY.aborted);
			this.used++;
			attempts++;
			try {
				const generation = {
					id: this.options.newId(),
					requestId,
					userSelections: selections,
					resolvedSelections,
					promptVersion: PROMPT_VERSION,
					prompt,
					referenceIds: REFERENCE_IDS,
					providerId: this.options.provider.id,
					modelId: this.options.provider.model,
					attempts,
					createdAt: this.options.now().toISOString()
				};
				await this.options.onPrepared?.(structuredClone(generation));
				const result = await abortable(this.options.provider, {
					prompt,
					referenceIds: REFERENCE_IDS,
					signal
				});
				const info = readPngInfo(result.bytes);
				if (result.mime !== "image/png" || !info || !info.width || !info.height || info.width > 4096 || info.height > 4096 || result.bytes.length > 16777216) throw new ProviderError("corrupt", COPY.corrupt);
				let binary = "";
				for (const byte of result.bytes) binary += String.fromCharCode(byte);
				return Response.json({
					ok: true,
					generation,
					image: {
						...info,
						mime: "image/png",
						base64: btoa(binary)
					},
					usage: {
						used: this.used,
						cap: this.options.limits.sessionCap
					}
				}, { headers: { "Cache-Control": "no-store" } });
			} catch (error) {
				const kind = error instanceof ProviderError ? error.kind : "network";
				if ((kind === "network" || kind === "corrupt") && attempts <= this.options.limits.technicalRetries && this.used < this.options.limits.sessionCap) continue;
				return failure$1(kind === "aborted" ? HTTP_CLIENT_CLOSED : kind === "safety" ? HTTP_UNPROCESSABLE : HTTP_BAD_GATEWAY$1, kind, COPY[kind]);
			}
		}
		return failure$1(429, "cap", COPY.cap);
	}
	replays(requestId) {
		return this.cache.has(requestId);
	}
	async handle(request) {
		if (request.method !== "POST") return failure$1(405, "invalid", COPY.method);
		let body;
		try {
			const text = await request.text();
			if (text.length > 4096) return failure$1(400, "invalid", COPY.invalid);
			body = JSON.parse(text);
			if (!body || typeof body !== "object" || Array.isArray(body)) return failure$1(400, "invalid", COPY.invalid);
		} catch {
			return failure$1(400, "invalid", COPY.invalid);
		}
		const validated = validateSelections(body.selections);
		const requestId = body.requestId;
		if (!validated.ok || typeof requestId !== "string" || !requestId.trim() || requestId.length > 64) return failure$1(400, "invalid", COPY.invalid);
		const fingerprint = JSON.stringify(validated.value);
		const cached = this.cache.get(requestId);
		if (cached) {
			if (cached.fingerprint !== fingerprint) return failure$1(409, "invalid", COPY.conflict);
			return (await cached.response).clone();
		}
		if (request.headers.has("x-loftio-replay-only")) return failure$1(HTTP_CONFLICT, "busy", COPY.busy);
		if (request.signal.aborted) return failure$1(HTTP_CLIENT_CLOSED, "aborted", COPY.aborted);
		if (this.used >= this.options.limits.sessionCap) return failure$1(429, "cap", COPY.cap);
		if (this.concurrent >= this.options.limits.maxConcurrent) return failure$1(409, "busy", COPY.busy);
		this.concurrent++;
		const response = this.generate(requestId, validated.value, request.signal).then(async (result) => {
			if (result.ok && this.options.onGenerated) try {
				await this.options.onGenerated(await result.clone().json());
			} catch {}
			if (UNCACHED_STATUSES.includes(result.status)) this.forget(requestId, entry);
			entry.settled = true;
			return result;
		}).catch((error) => {
			this.forget(requestId, entry);
			entry.settled = true;
			throw error;
		}).finally(() => {
			this.concurrent--;
		});
		const entry = {
			fingerprint,
			settled: false,
			response
		};
		this.cache.set(requestId, entry);
		this.evict();
		return (await response).clone();
	}
	forget(requestId, entry) {
		if (this.cache.get(requestId) === entry) this.cache.delete(requestId);
	}
	evict() {
		for (const [id, entry] of this.cache) {
			if (this.cache.size <= 32) return;
			if (entry.settled) this.cache.delete(id);
		}
	}
};
function createGenerateHandler(options) {
	const session = new GenerateSession(options);
	return Object.assign((request) => session.handle(request), { replays: (requestId) => session.replays(requestId) });
}
// .claude/worktrees/showcase-export-2/game/src/builder/server/online-copy.ts
var ONLINE_COPY = {
	human: "We couldn't confirm you're a person. Refresh the page and try again.",
	globalCap: "Loftio is out of magic for today. Come back tomorrow.",
	visitorCap: `You've made 3 residents today. Come back tomorrow for more.`,
	unconfigured: "The online builder isn't set up yet.",
	unavailable: "Loftio can't make residents right now. Try again in a little while."
};
// .claude/worktrees/showcase-export-2/game/src/builder/server/online-handler.ts
var HTTP_BAD_REQUEST$1 = 400;
var HTTP_FORBIDDEN = 403;
var HTTP_METHOD_NOT_ALLOWED = 405;
var HTTP_TOO_MANY = 429;
var HTTP_BAD_GATEWAY = 502;
var HTTP_UNAVAILABLE$1 = 503;
var RELEASING_KINDS = ["invalid", "busy"];
var UNKNOWN_IP = "unknown";
var HEX_RADIX = 16;
var failure = (status, kind, message) => Response.json({
	ok: false,
	error: {
		kind,
		message
	}
}, {
	status,
	headers: { "Cache-Control": "no-store" }
});
function clientIp(request) {
	const real = request.headers.get("x-real-ip")?.trim();
	if (real) return real;
	return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
async function readBody(request) {
	try {
		const text = await request.text();
		if (text.length > 4096) return null;
		const body = JSON.parse(text);
		return body && typeof body === "object" && !Array.isArray(body) ? body : null;
	} catch {
		return null;
	}
}
function isReplay(generate, requestId) {
	return typeof requestId === "string" && generate.replays?.(requestId) === true;
}
async function isHuman(verify, token, ip) {
	try {
		return Boolean(await verify(token, ip));
	} catch {
		return false;
	}
}
async function outcome(response) {
	try {
		const body = await response.clone().json();
		return {
			ok: body?.ok === true,
			kind: body?.error?.kind,
			body
		};
	} catch {
		return {
			ok: false,
			kind: void 0,
			body: void 0
		};
	}
}
function createOnlineHandler(options) {
	const pending = /* @__PURE__ */ new Map();
	async function admit(request, body, ip) {
		let reservation = null;
		if (!isReplay(options.generate, body.requestId)) {
			try {
				reservation = await options.caps.reserve(await options.visitorKey(ip));
			} catch {
				return failure(HTTP_UNAVAILABLE$1, "busy", ONLINE_COPY.unavailable);
			}
			if (!reservation.ok) return failure(HTTP_TOO_MANY, "cap", reservation.reason === "visitor" ? ONLINE_COPY.visitorCap : ONLINE_COPY.globalCap);
		}
		const forwarded = new Request(request.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...reservation ? {} : { [REPLAY_ONLY_HEADER]: "1" }
			},
			body: JSON.stringify({
				requestId: body.requestId,
				selections: body.selections
			}),
			signal: request.signal
		});
		let response;
		try {
			response = await options.generate(forwarded);
		} catch {
			return failure(HTTP_BAD_GATEWAY, "network", COPY.network);
		}
		const result = await outcome(response);
		if (result.ok) {
			const { usage: _usage, ...rest } = result.body;
			return Response.json(rest, {
				status: response.status,
				headers: { "Cache-Control": "no-store" }
			});
		}
		if (result.kind && RELEASING_KINDS.includes(result.kind) && reservation?.ok) await reservation.release().catch(() => {});
		return response;
	}
	return async function handle(request) {
		if (request.method !== "POST") return failure(HTTP_METHOD_NOT_ALLOWED, "invalid", COPY.method);
		const body = await readBody(request);
		if (!body) return failure(HTTP_BAD_REQUEST$1, "invalid", COPY.invalid);
		const ip = clientIp(request);
		if (!await isHuman(options.verifyHuman, body["turnstileToken"], ip)) return failure(HTTP_FORBIDDEN, "invalid", ONLINE_COPY.human);
		const id = typeof body.requestId === "string" ? body.requestId : null;
		if (id === null) return admit(request, body, ip);
		for (let earlier = pending.get(id); earlier; earlier = pending.get(id)) await earlier.catch(() => {});
		const run = admit(request, body, ip);
		pending.set(id, run);
		try {
			return await run;
		} finally {
			if (pending.get(id) === run) pending.delete(id);
		}
	};
}
async function visitorKeyFor(ip, salt) {
	const bytes = new TextEncoder().encode(`${salt}:${ip ?? UNKNOWN_IP}`);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(HEX_RADIX).padStart(2, "0")).join("");
}
// .claude/worktrees/showcase-export-2/game/src/builder/server/openai-provider.ts
var SAFETY_CODES = ["moderation_blocked", "content_policy_violation"];
var HTTP_BAD_REQUEST = 400;
var PROVIDER_ID = "openai-images";
var PNG_MIME = "image/png";
var text = (value) => typeof value === "string" ? value : null;
var consoleLog = (entry) => console.error("openai-images request failed", JSON.stringify(entry));
var fail = (kind) => new ProviderError(kind, COPY[kind]);
function isAbort(error, signal) {
	return Boolean(signal?.aborted) || error?.name === "AbortError";
}
function decodeBase64(value) {
	if (typeof value !== "string" || value === "") throw fail("corrupt");
	let binary;
	try {
		binary = atob(value);
	} catch {
		throw fail("corrupt");
	}
	if (binary === "") throw fail("corrupt");
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function readJson(response) {
	try {
		return await response.json();
	} catch {
		return;
	}
}
function isSafetyRejection(body) {
	const error = body?.error;
	return [error?.code, error?.type].some((value) => typeof value === "string" && SAFETY_CODES.includes(value));
}
async function loadAll(ids, load, signal) {
	try {
		return await Promise.all(ids.map((id) => load(id)));
	} catch (error) {
		throw fail(isAbort(error, signal) ? "aborted" : "network");
	}
}
function openaiProvider(options) {
	const model = options.model ?? "gpt-image-2.5-sunburst";
	const quality = options.quality ?? "medium";
	const doFetch = options.fetcher ?? fetch;
	function buildForm(prompt, ids, images) {
		const form = new FormData();
		form.append("model", model);
		images.forEach((bytes, index) => {
			form.append("image[]", new Blob([bytes], { type: PNG_MIME }), ids[index] + ".png");
		});
		form.append("prompt", prompt);
		form.append("size", IMAGE_SIZE);
		form.append("quality", quality);
		form.append("background", "transparent");
		form.append("output_format", "png");
		form.append("n", "1");
		if (options.safetyIdentifier) form.append("safety_identifier", options.safetyIdentifier);
		return form;
	}
	async function generate({ prompt, referenceIds, signal }) {
		const images = await loadAll(referenceIds, options.loadReference, signal);
		let response;
		try {
			response = await doFetch(OPENAI_EDITS_URL, {
				method: "POST",
				headers: { Authorization: "Bearer " + options.apiKey },
				body: buildForm(prompt, referenceIds, images),
				signal
			});
		} catch (error) {
			throw fail(isAbort(error, signal) ? "aborted" : "network");
		}
		const body = await readJson(response);
		if (!response.ok) {
			(options.log ?? consoleLog)({
				status: response.status,
				code: text(body?.error?.code),
				type: text(body?.error?.type)
			});
			throw fail(response.status === HTTP_BAD_REQUEST && isSafetyRejection(body) ? "safety" : "network");
		}
		return {
			bytes: decodeBase64(body?.data?.[0]?.b64_json),
			mime: PNG_MIME
		};
	}
	return {
		id: PROVIDER_ID,
		model,
		generate
	};
}
// .claude/worktrees/showcase-export-2/game/src/builder/server/turnstile-verify.ts
var TURNSTILE_TOKEN_MAX_LENGTH = 2048;
function turnstileVerifier(options) {
	const { secret, fetcher = fetch, expectedHostname } = options;
	return async (token, ip) => {
		if (typeof token !== "string" || token === "" || token.length > TURNSTILE_TOKEN_MAX_LENGTH) return false;
		try {
			const body = {
				secret,
				response: token
			};
			if (ip !== null) body.remoteip = ip;
			const res = await fetcher(TURNSTILE_VERIFY_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
			if (!res.ok) return false;
			const verdict = await res.json();
			if (verdict?.success !== true) return false;
			return expectedHostname === void 0 || verdict.hostname === expectedHostname;
		} catch {
			return false;
		}
	};
}
// .claude/worktrees/showcase-export-2/game/src/builder/server/vercel-entry.ts
var nodeProcess = globalThis.process;
var HTTP_UNAVAILABLE = 503;
var REQUIRED_ENV = [
	ENV.openaiKey,
	ENV.redisUrl,
	ENV.redisToken,
	ENV.turnstileSecret,
	ENV.visitorSalt
];
var unconfigured = () => Response.json({
	ok: false,
	error: {
		kind: "busy",
		message: ONLINE_COPY.unconfigured
	}
}, {
	status: HTTP_UNAVAILABLE,
	headers: { "Cache-Control": "no-store" }
});
var liveFetch = (...args) => fetch(...args);
var withMarketplaceNames = (env) => ({
	...env,
	[ENV.redisUrl]: env[ENV.redisUrl] || env[ENV.redisUrlMarketplace],
	[ENV.redisToken]: env[ENV.redisToken] || env[ENV.redisTokenMarketplace]
});
function createVercelHandler(given, options = {}) {
	const env = withMarketplaceNames(given);
	if (REQUIRED_ENV.some((name) => !env[name])) return async () => unconfigured();
	const referenceDir = options.referenceDir ?? join(nodeProcess.cwd(), "api", "_references");
	const salt = env[ENV.visitorSalt];
	const visitor = new AsyncLocalStorage();
	const generate = createGenerateHandler({
		provider: {
			id: "openai-images",
			model: env[ENV.model] || "gpt-image-2.5-sunburst",
			generate: (request) => openaiProvider({
				apiKey: env[ENV.openaiKey],
				model: env[ENV.model] || void 0,
				quality: env[ENV.quality] || void 0,
				fetcher: liveFetch,
				loadReference: async (id) => new Uint8Array(await readFile(join(referenceDir, `${id}.png`))),
				safetyIdentifier: visitor.getStore()?.key
			}).generate(request)
		},
		limits: ONLINE_LIMITS,
		rng: Math.random,
		newId: () => crypto.randomUUID(),
		now: () => /* @__PURE__ */ new Date()
	});
	const online = createOnlineHandler({
		verifyHuman: turnstileVerifier({
			secret: env[ENV.turnstileSecret],
			fetcher: liveFetch
		}),
		caps: createCaps({
			store: upstashStore({
				url: env[ENV.redisUrl],
				token: env[ENV.redisToken],
				fetcher: liveFetch
			}),
			now: () => /* @__PURE__ */ new Date()
		}),
		visitorKey: async (ip) => {
			const key = await visitorKeyFor(ip, salt);
			const store = visitor.getStore();
			if (store) store.key = key;
			return key;
		},
		generate
	});
	return (request) => visitor.run({}, () => online(request));
}
var handler;
function POST(request) {
	handler ??= createVercelHandler(nodeProcess.env);
	return handler(request);
}
export { POST, createVercelHandler };
