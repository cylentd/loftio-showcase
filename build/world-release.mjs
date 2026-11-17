import { readFile, mkdir, copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const gameRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = fileURLToPath(new URL('./world-files.json', import.meta.url));
const route = '/play/valley/';
const assetName = /^(?:[\w-]+\.(?:html|css|mp3)|src\/[\w-]+\.js|assets\/(?:residents|neighbours)\/[\w-]+\.png)$/;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };

export async function publishWorld(root, output) {
  const source = resolve(root, 'prototypes/loft-world');
  const target = resolve(output, 'play/valley');
  const files = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(files) || !files.every(name => typeof name === 'string' && assetName.test(name))) throw new Error('Invalid world runtime allowlist');
  await build({
    configFile: false, root: source, publicDir: false, base: './', logLevel: 'warn',
    plugins: [{ name: 'world-release-html', transformIndexHtml: { order: 'pre', handler: html => html
      .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
      .replace('<html lang="en">', '<html lang="en" data-published-world>') } }],
    build: { outDir: target, emptyOutDir: true, assetsInlineLimit: 0 },
  });
  for (const name of files.filter(name => /\.(png|mp3)$/.test(name))) {
    await mkdir(dirname(join(target, name)), { recursive: true });
    await copyFile(join(source, name), join(target, name));
  }
}

async function builtFiles(directory, prefix = route) {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name), url = prefix + entry.name;
    if (entry.isDirectory()) for (const pair of await builtFiles(filename, url + '/')) files.set(...pair);
    else files.set(url, filename);
  }
  return files;
}

export function worldRelease() {
  let output, temporary, prepared;
  return {
    name: 'loftio-world-release',
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.httpServer?.once('close', () => { if (temporary) void rm(temporary, { recursive: true, force: true }); });
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split(/[?#]/)[0];
        if (!url?.startsWith(route)) return next();
        if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; res.end(); return; }
        try {
          prepared ??= (async () => {
            temporary = await mkdtemp(join(tmpdir(), 'loftio-valley-'));
            await publishWorld(gameRoot, temporary);
            return builtFiles(join(temporary, 'play/valley'));
          })();
          const files = await prepared, filename = files.get(url === route ? url + 'index.html' : url);
          if (!filename) { res.statusCode = 404; res.end(); return; }
          res.setHeader('Content-Type', types[extname(filename)] ?? 'application/octet-stream');
          res.end(req.method === 'HEAD' ? undefined : await readFile(filename));
        } catch (error) { next(error); }
      });
    },
    async closeBundle() { await publishWorld(gameRoot, output); },
  };
}
