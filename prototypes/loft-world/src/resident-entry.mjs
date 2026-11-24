const READER_PATH = '/play/resident-reader.mjs';
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const RIFF = [82, 73, 70, 70];
const WEBP = [87, 69, 66, 80];
const WEBP_TAG_OFFSET = 8;

let pendingArt;

export async function loadWorld(art) {
  pendingArt = art;
  try { await import('./main.js'); }
  finally { pendingArt = undefined; }
}

export function takeResidentArt() {
  const art = pendingArt;
  pendingArt = undefined;
  return art;
}

function selectedId(search) {
  const params = new URLSearchParams(search);
  const views = params.getAll('view');
  if (!views.includes('play') || !params.has('resident')) return undefined;
  if (views.length !== 1 || params.getAll('resident').length !== 1) return null;
  const field = search.replace(/^\?/, '').split('&').find(part => new URLSearchParams('&' + part).has('resident'));
  const raw = field.includes('=') ? field.slice(field.indexOf('=') + 1) : '';
  try { return decodeURIComponent(raw.replaceAll('+', ' ')) || null; }
  catch { return null; }
}

async function playableImage(blob) {
  if (!(blob instanceof Blob) || !['image/png', 'image/webp'].includes(blob.type)) return false;
  const bytes = new Uint8Array(await blob.slice(0, WEBP_TAG_OFFSET + WEBP.length).arrayBuffer());
  const matches = (signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  return blob.type === 'image/png' ? matches(PNG) : matches(RIFF) && matches(WEBP, WEBP_TAG_OFFSET);
}

export async function enterWorld(search, {
  start, unavailable, decode,
  importReader = () => import(/* @vite-ignore */ READER_PATH),
}) {
  const id = selectedId(search);
  if (id === undefined) return start();
  if (id === null) return unavailable();
  let art;
  try {
    const { readPlayableResident } = await importReader();
    const saved = await readPlayableResident(id);
    if (saved?.id === id && await playableImage(saved.idle)) art = await decode(saved.idle);
  } catch { return unavailable(); }
  return art ? start(art) : unavailable();
}
