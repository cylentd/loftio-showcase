import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('./rumble-files.json', import.meta.url));
const runtimeDirectory = 'prototypes/loft-rumble';

function sharedTokens(gameRoot) {
  const privatePath = resolve(gameRoot, '../ui/styles/tokens.css');
  return existsSync(privatePath) ? privatePath : resolve(gameRoot, 'ui/styles/tokens.css');
}

function rewriteCss(text, source, target, paths, gameRoot) {
  return text.replace(/(["'])([^"']+)\1/g, (match, quote, spec) => {
    const resolved = spec.startsWith('/') ? resolve(gameRoot, 'public', spec.slice(1)) : resolve(dirname(source), spec);
    const mapped = paths.get(resolved);
    if (!mapped) return match;
    const destination = relative(dirname(target), mapped).replaceAll('\\', '/');
    return quote + (destination.startsWith('.') ? destination : './' + destination) + quote;
  });
}

// The one allowlist: the manifest names (checked against this pattern) plus three shared files.
// The build copies exactly these; the dev server serves exactly these.
const routePrefix = '/play/rumble/';
const routeDirectory = 'play/rumble';
const manifestName = /^(?:[\w-]+\.(?:html|js|css)|audio\/[\w-]+\.mp3|video\/[\w-]+\.mp4|art\/[\w-]+\.webp|assets\/camera-storybook\/[\w-]+\.webp)$/;
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

// Allowlisted source file -> its path under `root` (the build output, or a virtual root in dev).
function rumbleTargets(gameRoot, root, manifestFile = manifestPath) {
  const files = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const paths = new Map();
  for (const name of files) {
    if (!manifestName.test(name)) throw new Error('Unsafe Rumble runtime path: ' + name);
    paths.set(resolve(gameRoot, runtimeDirectory, name), join(root, routeDirectory, name === 'loft-rumble-realtime.html' ? 'index.html' : name));
  }
  paths.set(resolve(gameRoot, 'src/tokens.css'), join(root, routeDirectory, 'tokens.css'));
  paths.set(sharedTokens(gameRoot), join(root, routeDirectory, 'shared-tokens.css'));
  paths.set(resolve(gameRoot, 'public/fonts/nunito-latin.woff2'), join(root, routeDirectory, 'nunito-latin.woff2'));
  return paths;
}

async function renderRumbleFile(source, target, paths, gameRoot) {
  let bytes = await readFile(source);
  if (source.endsWith('.css')) bytes = rewriteCss(bytes.toString(), source, target, paths, gameRoot);
  if (source.endsWith('.html')) bytes = bytes.toString()
    .replace('<html lang="en">', '<html lang="en" data-published-rumble>')
    .replace('<title>Loft Rumble · Real-time</title>', '<title>Loft Rumble · Loftio</title>')
    .replace('<a class="mode-link" href="loft-rumble.html">Try turn-based</a>', '');
  return bytes;
}

export async function publishRumble(gameRoot, output) {
  const paths = rumbleTargets(gameRoot, output);
  const contents = await Promise.all([...paths].map(async ([source, target]) => [target, await renderRumbleFile(source, target, paths, gameRoot)]));
  for (const [target, bytes] of contents) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

// A request path maps to a file only by exact match against the allowlist; it is never joined to a path.
export function resolveRumbleRequest(gameRoot, url, manifestFile = manifestPath) {
  let pathname;
  try { pathname = decodeURIComponent(url.split(/[?#]/)[0]); } catch { return null; }
  if (pathname === routePrefix) pathname += 'index.html';
  if (!pathname.startsWith(routePrefix)) return null;
  const target = pathname.slice(1);
  for (const [source, mapped] of rumbleTargets(gameRoot, '', manifestFile)) {
    if (mapped.replaceAll('\\', '/').replace(/^\//, '') === target) return { source, target };
  }
  return null;
}

export function rumbleDevMiddleware(gameRoot, manifestFile = manifestPath) {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let hit;
    try { hit = resolveRumbleRequest(gameRoot, req.url ?? '', manifestFile); } catch (error) { return next(error); }
    if (!hit) return next();
    try {
      const devRoot = resolve(gameRoot, '.rumble-dev'); // only anchors CSS url rewrites; nothing is written there
      const paths = rumbleTargets(gameRoot, devRoot, manifestFile);
      const bytes = Buffer.from(await renderRumbleFile(hit.source, join(devRoot, hit.target), paths, gameRoot));
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypes[extname(hit.source)] ?? 'application/octet-stream');
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { next(error); }
  };
}

export function rumbleRelease() {
  let gameRoot, output;
  const root = resolve(dirname(manifestPath), '..');
  return {
    name: 'loftio-rumble-release',
    configResolved(config) { gameRoot = root; output = resolve(config.root, config.build.outDir); },
    configureServer(server) { server.middlewares.use(rumbleDevMiddleware(root)); },
    async closeBundle() { await publishRumble(gameRoot, output); },
  };
}
