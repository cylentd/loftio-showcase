/*
 * Game test loader: lets a Node test import Vite-style view modules directly.
 *
 * Opt in: run node with `--import ./tests/support/register.ts` (the `test`
 * script in game/package.json does). register.ts installs these hooks.
 *
 * Rules, all applied only to files under game/ (see Scope):
 *  1. Extensionless: a relative import with no file extension resolves to
 *     <path>.ts, else <path>/index.ts. A specifier with an extension is left
 *     alone. No match falls through to Node's own not-found error.
 *  2. CSS: importing a .css file loads an empty module and runs no CSS.
 *  3. Assets: a file ending .png .webp .jpg .svg .mp3 .ogg .wav .mp4 .webm
 *     .woff2, or any specifier with a ?url query, loads a module whose default
 *     export is a string ending in the file's base name. A ?raw query loads the
 *     file text as the default export. ?url and ?raw win over the extension.
 *  4. Env: import.meta.env is a frozen object with MODE 'test', DEV true,
 *     PROD false, SSR false, BASE_URL '/', plus every VITE_* variable in
 *     process.env when the process started. Absent variables are undefined.
 *     The load hook rewrites the token on the same line, so stack traces keep
 *     their line numbers, and Node's type stripping still runs afterwards.
 *     It also applies inside a template literal's ${...} substitutions.
 *  5. Real modules: every module in game/src imports under these rules. The
 *     loader's test imports five, among them resident.ts and runtime.ts.
 *
 * Scope: a file is in scope when it sits under game/ and no segment of its
 * path is node_modules. Everything else keeps Node's normal behaviour, with
 * one exception: rules 2 and 3 also apply to any out-of-scope file that an
 * in-scope file imports (the room images in ui/assets, a package's CSS).
 *
 * Classes: Node strips types and rejects syntax that needs a transform, such
 * as constructor parameter properties and enums. game/tsconfig.json sets
 * erasableSyntaxOnly, so the type-check refuses them and every module in
 * game/src stays importable here.
 *
 * Hook API: module.registerHooks (synchronous, in-thread, Node >= 24). It was
 * chosen over module.register because the hooks run in the test's own thread,
 * so dynamic import() works and the env snapshot needs no message passing.
 */
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT_URL = new URL('../../', import.meta.url).href;
const ENV_GLOBAL = '__loftioViteEnv';
const ENV_TOKEN = 'import.meta.env';
// Matches comments and string literals first so the token is only rewritten in code.
const ENV_SCAN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`|\bimport\.meta\.env\b/g;
const TEMPLATE_SUBSTITUTION = /\$\{(?:[^{}]|\{[^{}]*\})*\}/g;
const ASSET_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.svg', '.mp3', '.ogg', '.wav', '.mp4', '.webm', '.woff2']);
const ASSET_URL_PREFIX = '/assets/';

type Resolved = { url: string; format?: string; shortCircuit?: boolean };
type Loaded = { format?: string; source?: string | Buffer | Uint8Array; shortCircuit?: boolean };

function inScope(url: string | undefined): boolean {
  if (!url || !url.startsWith(GAME_ROOT_URL)) return false;
  return !url.slice(GAME_ROOT_URL.length).split('/').includes('node_modules');
}

function viteEnv(): Readonly<Record<string, unknown>> {
  const env: Record<string, unknown> = { MODE: 'test', DEV: true, PROD: false, SSR: false, BASE_URL: '/' };
  for (const [key, value] of Object.entries(process.env)) if (key.startsWith('VITE_')) env[key] = value;
  return Object.freeze(env);
}

function exists(url: URL): boolean {
  return existsSync(fileURLToPath(url));
}

function resolveExtensionless(specifier: string, parentURL: string): Resolved | undefined {
  const [bare = ''] = specifier.split(/[?#]/);
  if (!bare.startsWith('.') || extname(bare) !== '') return undefined;
  const asFile = new URL(`${bare}.ts`, parentURL);
  if (exists(asFile)) return { url: asFile.href, shortCircuit: true };
  const asIndex = new URL(`${bare.replace(/\/$/, '')}/index.ts`, parentURL);
  if (exists(asIndex)) return { url: asIndex.href, shortCircuit: true };
  return undefined;
}

function query(url: string): string | undefined {
  const search = new URL(url).searchParams;
  if (search.has('raw')) return 'raw';
  if (search.has('url')) return 'url';
  return undefined;
}

function moduleSource(text: string): Loaded {
  return { format: 'module', source: text, shortCircuit: true };
}

function loadSpecial(url: string): Loaded | undefined {
  const path = new URL(url);
  const kind = query(url);
  if (kind === 'raw') return moduleSource(`export default ${JSON.stringify(readFileSync(path, 'utf8'))};`);
  const ext = extname(path.pathname);
  if (kind === 'url' || ASSET_EXTENSIONS.has(ext)) {
    return moduleSource(`export default ${JSON.stringify(ASSET_URL_PREFIX + basename(path.pathname))};`);
  }
  if (ext === '.css') return moduleSource('');
  return undefined;
}

function withEnv(loaded: Loaded): Loaded {
  if (loaded.source === undefined) return loaded;
  const text = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
  const source = text.replace(ENV_SCAN, (match) => {
    if (match === ENV_TOKEN) return `globalThis.${ENV_GLOBAL}`;
    // A template literal's ${...} is code: rewrite the token there, not in its text (one nesting level of braces).
    if (match.startsWith('`')) return match.replace(TEMPLATE_SUBSTITUTION, (part) => part.replaceAll(ENV_TOKEN, `globalThis.${ENV_GLOBAL}`));
    return match;
  });
  return { ...loaded, source };
}

export function register(): void {
  (globalThis as Record<string, unknown>)[ENV_GLOBAL] = viteEnv();
  // URLs outside game/ that a game file imported: rules 2 and 3 apply to them too.
  const shared = new Set<string>();
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (!inScope(context.parentURL)) return nextResolve(specifier, context);
      const found = resolveExtensionless(specifier, context.parentURL as string);
      if (found) return found;
      const resolved = nextResolve(specifier, context);
      if (!inScope(resolved.url) && resolved.url.startsWith('file:')) shared.add(resolved.url);
      return resolved;
    },
    load(url, context, nextLoad) {
      if (shared.has(url)) return (loadSpecial(url) ?? nextLoad(url, context)) as ReturnType<typeof nextLoad>;
      if (!inScope(url)) return nextLoad(url, context);
      const special = loadSpecial(url);
      if (special) return special as ReturnType<typeof nextLoad>; // Loaded.format is a plain string; Node wants its format union
      return withEnv(nextLoad(url, context) as Loaded) as ReturnType<typeof nextLoad>;
    },
  });
}
