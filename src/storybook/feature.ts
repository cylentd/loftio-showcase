import type { Ticker } from 'pixi.js';
import type { ResidentHooks } from '../residents/view';
import { binderCards, cardSourceFor } from '../binder/binder-cards-model';
import { cardArtFor } from '../holo-card/card-art';
import { holoFace } from '../binder/binder-pocket';
import { BINDER } from '../binder/constants';
import { liveHoloZoom } from '../holo-card/feature';
import { paintHoloTextures } from '../holo-card/holo-textures';
import '../holo-card/holo-card.css';
import '../holo-card/holo-types.css';
import '../binder/binder.css';
import { storybookArt, preloadCover, whenIdle } from './art';
import { SHELF, STORYBOOK_LOAD } from './constants';
import { storybookPage } from './storybook';
import { introduceShelf, placeShelf, storybookTrigger } from './shelf';
import './storybook.css';
import './shelf.css';

export { storybookTrigger } from './shelf';

export const storybookFlag = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return params.has('storybook') && params.get('mode') === 'mock';
};

type ShelfRoom = {
  app: { ticker: Pick<Ticker, 'add' | 'remove'> };
  look: Parameters<typeof placeShelf>[2] & { readonly frozen: boolean };
  shell: HTMLElement;
  residents?: ResidentHooks;
};

function madeCards(residents: ResidentHooks | undefined) {
  const kept = residents?.kept?.() ?? [];
  return binderCards({ originals: [], kept: kept.map(({ record, name }) => cardSourceFor(record, cardArtFor(record), name)),
    loft: new Set(kept.filter(resident => resident.inLoft).map(resident => resident.record.id)) }, () => null);
}

export function storybookEntry(search: string, surface: 'game' | 'showcase') {
  if (surface === 'showcase') return { autoOpen: false, artSearch: '' };
  if (!storybookFlag(search)) return null;
  return { autoOpen: new URLSearchParams(search).get('storybook') !== SHELF.look, artSearch: search };
}

function mountStorybook({ app, look, shell, residents }: ShelfRoom, surface: 'game' | 'showcase'): { ready: () => void; teardown: () => void } | void {
  const entry = storybookEntry(location.search, surface);
  if (!entry) return;
  const world = shell.querySelector('#world');
  if (!world) return;
  let page: ReturnType<typeof storybookPage> | null = null, trigger: HTMLButtonElement | null = null;
  let waiting: HTMLDialogElement | null = null;
  const art = storybookArt(entry.artSearch, location.href);
  whenIdle(() => void preloadCover(art), STORYBOOK_LOAD.preloadIdleMs);
  const position = () => {
    const room = shell.dataset.room;
    if (!trigger || (room !== 'desktop' && room !== 'portrait')) return;
    placeShelf(trigger, room, look);
    trigger.toggleAttribute('data-still', look.frozen);
  };
  const afterDialogs = () => {
    waiting = document.querySelector('dialog[open]');
    if (waiting) return waiting.addEventListener('close', afterDialogs, { once: true });
    if (entry.autoOpen) void page?.open();
    else if (trigger) introduceShelf(trigger);
  };
  const ready = () => {
    if (page) return;
    paintHoloTextures();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    trigger = storybookTrigger(cover => void page?.open(cover.getBoundingClientRect()));
    world.append(trigger);
    position();
    app.ticker.add(position);
    const tray = document.querySelector<HTMLElement>('.scene-actions');
    page = storybookPage({ reduced, layout: matchMedia(BINDER.phoneQuery), face: subject => holoFace(subject, true), zoom: liveHoloZoom,
      trigger, tray, art, readMadeCards: () => madeCards(residents), recoverAlt: residents?.recoverAlt });
    afterDialogs();
  };
  const teardown = () => {
    app.ticker.remove(position);
    waiting?.removeEventListener('close', afterDialogs);
    page?.dispose(); page = null; trigger?.remove(); trigger = null;
  };
  return { ready, teardown };
}

export const storybook = (room: ShelfRoom) => mountStorybook(room, 'game');
export const showcaseStorybook = (room: ShelfRoom) => mountStorybook(room, 'showcase');
