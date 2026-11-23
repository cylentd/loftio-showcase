// The binder as a live view (#477 U4): every resident's card in pages of pockets, the page turn, the loft marks and the
// options sheet. Card facts come in through `update` (binder-cards-model.ts shapes); the open page, the sheet and busy
// all live in G14 (`nextBinder`), never in this file. The `?binder` look test (binder.ts) mounts it; the storybook page
// (#565, game/src/storybook/) replaces it once the owner approves that look.
import { el } from '../holo-card/holo-card-faces';
import type { CardSubject } from '../holo-card/holo-card-subject';
import { boardStep, initialBoard, tabHolo, type BoardAction } from '../holo-card/holo-compare-model';
import { holoPicker, paintPicker } from '../holo-card/holo-picker';
import type { HoloId } from '../holo-card/holo-type-data';
import { bindTurns, bookChrome, pager, type Layout } from './binder-book';
import type { BinderCard } from './binder-cards-model';
import { BINDER } from './constants';
import { BINDER_COPY } from './binder-copy';
import { binderPages } from './binder-model';
import { cardPocket, emptyPocket, type CardFace, type CardPocket } from './binder-pocket';
import { optionsSheet, type SheetContent, type SheetEntry } from './binder-sheet';

/** An action on a resident's card, listed in the options sheet while `available` says so. */
export type CardAction = {
  id: string; label: string;
  available(card: BinderCard): boolean;
  run(card: BinderCard, trigger: HTMLElement): void | Promise<void>;
};
/** The loft move every card has (Send home or Invite in). `blocked` is why it cannot run now, e.g. a full loft. */
export type CoreAction = CardAction & { blocked?(card: BinderCard): string | null };
/** The picker's look for the big card: the holo for a card seed (`lookSeed` in holo-card/feature.ts) and the foil
 * animation. */
/** `side`: the card the big view opens on (`cozy`, `action`); unset or unknown opens on Normal. */
export type ZoomLook = { holo: (seed: string) => HoloId; animate: boolean; side?: string };
/** The seed a card's look is picked by under Mix: the resident and which of its cards (`normal`, `cozy`, `action`, `alt`). */
export const lookSeed = (id: string, side: string) => `${id}|${side}`;
/** The big card a tap opens (game only). With none, a tap opens the options sheet. `done` is called once the big card
 * has closed, so G14 can leave `zoomed`. */
export type CardZoom = { open(card: BinderCard, trigger: HTMLElement, done: () => void, look?: ZoomLook): void };

/** One card the binder shows, with what only its owner knows: how to draw it, its loft move, a feature's block. */
export type PanelCard = { card: BinderCard; subject: CardSubject; core: CoreAction; detail?: () => HTMLElement | null };

export type PanelDeps = {
  reduced: boolean;
  layout: Layout;
  face: (subject: CardSubject) => CardFace;
  zoom?: CardZoom;
  actions?: readonly CardAction[];
  /** Big title over the book (the look test); null in the drawer, whose header already names it. */
  title: string | null;
};

type Book = ReturnType<typeof pager>;
type Sheet = ReturnType<typeof optionsSheet>;

const artKey = (entry: PanelCard) => `${entry.card.id}|${entry.card.art.normal}|${entry.card.art.alt ?? ''}`;

/** The sheet for one card: its loft move, then the actions that are available for it. */
function sheetContent(entry: PanelCard, actions: readonly CardAction[], trigger: HTMLElement): SheetContent {
  const card = entry.card;
  const entries = [entry.core, ...actions].filter(action => action.available(card)).map((action): SheetEntry => ({
    id: action.id, label: action.label, run: () => action.run(card, trigger),
    blocked: (action as CoreAction).blocked?.(card) ?? null,
  }));
  return { id: card.id, name: card.name, inLoft: card.inLoft, detail: entry.detail?.() ?? null, entries };
}

/** Runs one sheet action through G14: busy while it runs, closed on success, an alert and no change on failure. */
async function runAction(book: Book, sheet: Sheet, entry: SheetEntry): Promise<void> {
  const before = book.state();
  if (before.kind !== 'options' || book.send({ type: 'act' }) === before) return; // G14: one action at a time
  sheet.busy(true);
  try {
    await entry.run();
    book.send({ type: 'acted', ok: true });
    sheet.busy(false); sheet.close();
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : BINDER_COPY.failed;
    book.send({ type: 'acted', ok: false, error: message });
    sheet.busy(false); sheet.fail(message);
  }
}

function endpaper(): HTMLElement {
  const blank = el('section', 'binder-page binder-endpaper');
  blank.append(el('p', 'binder-endpaper-word', BINDER_COPY.endpaper));
  return blank;
}

/** The holo picker (#477 U7): the compare board's tab and toggle, for this session only. It dresses every pocket card
 *  (`faces`) and the zoom; the foil idles on the pockets only while no big card is open. */
function panelLook(root: HTMLElement, reduced: boolean, faces: () => Iterable<[string, CardFace]>) {
  let look = initialBoard(reduced);
  let zoomed = false;
  const holoOf = (seed: string) => tabHolo(look.tab, seed);
  const dress = (id: string, face: CardFace) => {
    if (face.look) face.look.dataset.holo = holoOf(lookSeed(id, 'normal'));
    face.tilt?.setIdle(look.animate && !zoomed);
  };
  const paint = () => {
    root.dataset.holo = look.tab;
    root.dataset.animate = look.animate ? 'on' : 'off';
    paintPicker(look, picker);
    for (const [id, face] of faces()) dress(id, face);
  };
  const picker = holoPicker((action: BoardAction) => { look = boardStep(look, action, reduced); paint(); }, 'binder-picker');
  const chrome = [...root.children] as HTMLElement[]; // [title], book, nav: the picker goes above the book
  root.replaceChildren(...chrome.slice(0, -2), picker.bar, ...chrome.slice(-2));
  return { dress, paint, zoomLook: (): ZoomLook => ({ holo: holoOf, animate: look.animate }), setZoomed: (on: boolean) => { zoomed = on; paint(); } };
}

/** The pockets, one per resident, rebuilt only when that resident's art changes. */
function pocketStore(deps: PanelDeps, dress: (id: string, face: CardFace) => void,
  onTap: (id: string, from: HTMLElement) => void, onMark: (id: string, from: HTMLElement) => void) {
  const pockets = new Map<string, { key: string; pocket: CardPocket }>();
  const pocketFor = (entry: PanelCard): CardPocket => {
    const key = artKey(entry), id = entry.card.id, held = pockets.get(id);
    if (held && held.key === key) return held.pocket;
    held?.pocket.dispose();
    const pocket = cardPocket(id, entry.card.name, deps.face(entry.subject), entry.card.art.alt, from => onTap(id, from), from => onMark(id, from));
    dress(id, pocket.face);
    pockets.set(id, { key, pocket });
    return pocket;
  };
  const prune = (keep: ReadonlyMap<string, unknown>) => {
    for (const [id, held] of pockets) if (!keep.has(id)) { held.pocket.dispose(); pockets.delete(id); }
  };
  const faces = function* (): Iterable<[string, CardFace]> { for (const [id, held] of pockets) yield [id, held.pocket.face]; };
  const dispose = () => { for (const held of pockets.values()) held.pocket.dispose(); pockets.clear(); };
  return { pocketFor, prune, faces, dispose };
}

export function binderPanel(deps: PanelDeps) {
  const ui = bookChrome(deps.title);
  const book = pager(ui, endpaper(), deps.layout, deps.reduced);
  const unbind = bindTurns(ui, book.turn, ui.root);
  let cards = new Map<string, PanelCard>();
  let trigger: HTMLElement = ui.root;
  const sheet = optionsSheet(entry => void runAction(book, sheet, entry));
  sheet.dialog.addEventListener('close', () => book.send({ type: 'close' }));
  const content = (entry: PanelCard) => sheetContent(entry, deps.actions ?? [], trigger);

  const openSheet = (id: string, from: HTMLElement) => {
    const entry = cards.get(id), before = book.state();
    if (!entry || book.send({ type: 'options', id }) === before) return; // G14 refuses it mid-turn or with a sheet open
    trigger = from;
    sheet.open(content(entry), from, ui.root);
  };
  const look = panelLook(ui.root, deps.reduced, () => store.faces());
  const onTap = (id: string, from: HTMLElement) => {
    const entry = cards.get(id);
    if (!entry) return;
    if (!deps.zoom) { openSheet(id, from); return; }
    const before = book.state();
    if (book.send({ type: 'open', id }) === before) return; // G14 refuses it mid-turn, zoomed or with a sheet open
    look.setZoomed(true);
    deps.zoom.open(entry.card, from, () => { book.send({ type: 'close' }); look.setZoomed(false); }, look.zoomLook());
  };
  const store = pocketStore(deps, look.dress, onTap, openSheet);
  const pageOf = (slots: ReturnType<typeof binderPages>[number]) => {
    const page = el('section', 'binder-page');
    page.append(...slots.map(slot => {
      if (slot.kind === 'empty') return emptyPocket();
      const entry = cards.get(slot.id)!, pocket = store.pocketFor(entry);
      pocket.setInLoft(entry.card.inLoft);
      return pocket.root;
    }));
    return page;
  };

  /** Draws the cards in order. A resident whose sheet is open and who is gone closes it and focuses the page. */
  const update = (next: readonly PanelCard[]) => {
    cards = new Map(next.map(entry => [entry.card.id, entry]));
    store.prune(cards);
    const ids = next.map(entry => entry.card.id);
    book.setPages(binderPages(ids, BINDER.perPage, BINDER.minPages).map(pageOf), ids);
    look.paint();
    const open = sheet.shown(), entry = open === null ? undefined : cards.get(open);
    if (open !== null && (!entry || book.state().kind !== 'options')) sheet.leave(); else if (entry) sheet.refresh(content(entry));
  };

  return {
    root: ui.root, sheet: sheet.dialog, update,
    dispose: () => { unbind(); book.dispose(); store.dispose(); sheet.dialog.remove(); },
  };
}
