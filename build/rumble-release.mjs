import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('./rumble-files.json', import.meta.url));
const runtimeDirectory = 'prototypes/loft-rumble';

async function sharedTokens(gameRoot) {
  const privatePath = resolve(gameRoot, '../ui/styles/tokens.css');
  return await access(privatePath).then(() => privatePath, () => resolve(gameRoot, 'ui/styles/tokens.css'));
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

export async function publishRumble(gameRoot, output) {
  const files = JSON.parse(await readFile(manifestPath, 'utf8'));
  const paths = new Map();
  for (const name of files) {
    if (!/^(?:[\w-]+\.(?:html|js|css)|art\/[\w-]+\.webp|assets\/camera-storybook\/[\w-]+\.webp)$/.test(name)) {
      throw new Error('Unsafe Rumble runtime path: ' + name);
    }
    paths.set(resolve(gameRoot, runtimeDirectory, name), join(output, 'play/rumble', name === 'loft-rumble-realtime.html' ? 'index.html' : name));
  }
  paths.set(resolve(gameRoot, 'src/tokens.css'), join(output, 'play/rumble/tokens.css'));
  paths.set(await sharedTokens(gameRoot), join(output, 'play/rumble/shared-tokens.css'));
  paths.set(resolve(gameRoot, 'public/fonts/nunito-latin.woff2'), join(output, 'play/rumble/nunito-latin.woff2'));
  const contents = await Promise.all([...paths].map(async ([source, target]) => {
    let bytes = await readFile(source);
    if (source.endsWith('.css')) bytes = rewriteCss(bytes.toString(), source, target, paths, gameRoot);
    if (source.endsWith('.html')) bytes = bytes.toString()
      .replace('<html lang="en">', '<html lang="en" data-published-rumble>')
      .replace('<title>Loft Rumble · Real-time</title>', '<title>Loft Rumble · Loftio</title>')
      .replace('<a class="mode-link" href="loft-rumble.html">Try turn-based</a>', '');
    return [target, bytes];
  }));
  for (const [target, bytes] of contents) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

export function rumbleRelease() {
  let gameRoot, output;
  return {
    name: 'loftio-rumble-release',
    configResolved(config) { gameRoot = resolve(dirname(manifestPath), '..'); output = resolve(config.root, config.build.outDir); },
    async closeBundle() { await publishRumble(gameRoot, output); },
  };
}
