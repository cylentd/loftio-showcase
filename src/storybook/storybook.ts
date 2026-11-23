// The storybook page (#565): full screen above the room, a closed book whose cover swings open, pages turned by the
// arrows, a swipe or the arrow keys, and the holo picker under the book (thumb reach on a phone). G15 (state.ts) owns
// the lifecycle; this file only draws it. While open the rest of the page is inert and the tray hidden; Escape closes
// (a big card closes first, by its own dialog) and focus returns to the trigger.
import { onSwipe, type Layout } from '../binder/binder-book';
import { lookSeed, type CardZoom } from '../binder/binder-panel';
import type { BinderCard } from '../binder/binder-cards-model';
import type { CardFace } from '../binder/binder-pocket';
import { el } from '../holo-card/holo-card-faces';
import { ALT_ART_IMAGES } from '../holo-card/holo-card-scenes';
import { originalSubject, type CardSubject } from '../holo-card/holo-card-subject';
import { boardStep, initialBoard, tabHolo, type BoardAction } from '../holo-card/holo-compare-model';
import { holoPicker, paintPicker } from '../holo-card/holo-picker';
import { ALT_VARIANT } from '../binder/constants';
import { ROOM_MODAL_CLASS } from '../world-ui';
import { coverDecoded, coverOrTimeout, loadArtInOrder } from './art';
import { flyIn, type FlightClock, type FlightFrame, type Rect } from './flight';
import { arrow, bookDom, finishMotion, swingCover, turnPages } from './book';
import { STORYBOOK, STORYBOOK_LOAD } from './constants';
import { STORYBOOK_COPY } from './copy';
import { collectionCards, packPages, spreadCount, spreadPages, type PageCardData } from './pages';
import { pageView, type PageView } from './pages-view';
import { coverCue, nextStorybook, type StorybookEvent, type StorybookState } from './state';
import { tabFade } from './tab-fade';

export type StorybookDeps = {
  reduced: boolean;
  layout: Layout;
  face: (subject: CardSubject) => CardFace;
  zoom: CardZoom;
  trigger: HTMLElement;
  /** The corner tray: hidden and inert while the book is open. */
  tray: HTMLElement | null;
  /** Bundled art and optional look overrides, or null for code-drawn surfaces. */
  art: Parameters<typeof loadArtInOrder>[1] | null;
  readMadeCards?: () => readonly BinderCard[];
  recoverAlt?: NonNullable<import('../residents/view').ResidentHooks['recoverAlt']>;
  /** S6: the entrance's clock (flight.ts). Unset: the browser's frames; null: no flight, the book lands at once. */
  clock?: FlightClock | null;
};

const liveClock = (): FlightClock | null => typeof requestAnimationFrame === 'function'
  ? { now: () => performance.now(), frame: cb => { requestAnimationFrame(cb); } } : null;

/** An element's on-screen rect; a detached or unlaid element reads as zero size, so the book lands without a flight. */
function rectOf(node: HTMLElement): Rect {
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width || 0, height: r.height || 0 };
}

/** S6: draws one entrance frame on the book, the room's dim and the gold motes (made on the first frame that has any). */
function flightPainter(ui: ReturnType<typeof pageChrome>) {
  let layer: HTMLElement | null = null, painted = false;
  const paint = (f: FlightFrame) => {
    painted = true;
    ui.ui.book.style.setProperty('transform', `translate(${f.x}px, ${f.y}px) rotate(${f.turn}deg) scale(${f.scale})`);
    ui.ui.book.style.setProperty('opacity', String(f.opacity));
    ui.root.style.setProperty('--sb-dim', String(f.dim));
    if (f.motes.length && !layer) {
      layer = el('div', 'storybook-motes');
      layer.setAttribute('aria-hidden', 'true');
      layer.append(...f.motes.map(() => el('span', 'storybook-mote')));
      ui.ui.book.parentElement?.append(layer);
    }
    f.motes.forEach((m, i) => {
      const mote = layer?.children[i] as HTMLElement | undefined;
      mote?.style.setProperty('transform', `translate(${m.x}px, ${m.y}px)`);
      mote?.style.setProperty('opacity', String(m.opacity));
    });
  };
  /** Clears what the frames set (nothing, when the book landed without a flight). */
  const clear = () => {
    if (painted) for (const [node, prop] of [[ui.ui.book, 'transform'], [ui.ui.book, 'opacity'], [ui.root, '--sb-dim']] as const) node.style.setProperty(prop, '');
    layer?.remove();
    layer = null; painted = false;
  };
  return { paint, clear };
}

function pageChrome() {
  const root = el('section', `storybook ${ROOM_MODAL_CLASS}`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', STORYBOOK_COPY.title);
  const close = el('button', 'storybook-close');
  close.type = 'button';
  close.setAttribute('aria-label', STORYBOOK_COPY.close);
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const ui = bookDom(), prev = arrow('prev'), next = arrow('next');
  const counter = el('p', 'storybook-counter');
  counter.setAttribute('aria-live', 'polite');
  const nav = el('nav', 'storybook-nav'), dock = el('div', 'storybook-dock');
  nav.append(prev, counter, next);
  const stage = el('div', 'storybook-stage');
  stage.append(ui.book);
  root.append(close, stage, dock);
  return { root, close, ui, prev, next, counter, nav, dock };
}

/** The original as the big card wants it: its normal painting and its action alt, so the switch offers all three. */
const zoomCard = (id: string): BinderCard => {
  const subject = originalSubject(id as never, '', null);
  return { id, kind: 'original', name: subject.name, inLoft: true, art: { normal: subject.idle, alt: ALT_ART_IMAGES[`${id}-${ALT_VARIANT}`] }, look: null };
};

/** Hides everything but the page from the keyboard and screen readers, and the tray from sight. Returns the undo. */
function quietRoom(root: HTMLElement, tray: HTMLElement | null): () => void {
  const quieted = [...(document.body.children as unknown as HTMLElement[])].filter(node => node !== root && !node.inert);
  for (const node of quieted) node.inert = true;
  const trayWasHidden = tray?.hidden ?? false;
  if (tray) { tray.inert = true; tray.hidden = true; }
  return () => {
    for (const node of quieted) node.inert = false;
    if (tray) { tray.inert = false; tray.hidden = trayWasHidden; }
  };
}

/** What the book shows: G15's state, the pages built so far, the picker's look, and drawing them. */
function bookView(deps: StorybookDeps, openZoom: (card: PageCardData, button: HTMLButtonElement) => void) {
  const ui = pageChrome();
  const core = {
    ui, state: { kind: 'closed' } as StorybookState, look: initialBoard(deps.reduced),
    pages: [] as PageCardData[][],
    resetPages: () => {
      for (const held of core.views.values()) held.dispose();
      core.views.clear();
      core.pages = packPages(collectionCards(deps.readMadeCards?.() ?? []), STORYBOOK.slotsPerPage, STORYBOOK.perViewPhone).pages;
    },
    /** The tab last scrolled into view on the phone's strip: a repaint scrolls only when the pick changed. */
    revealed: null as string | null,
    send: (event: StorybookEvent) => { const before = core.state; core.state = nextStorybook(before, event); return core.state !== before; },
    /** What the page shows (`data-state`) and, while that is the closed book, its open cue (`data-cue`). */
    mark: (shown: string) => {
      ui.root.dataset.state = shown;
      const cue = coverCue(core.state, shown, deps.reduced);
      if (cue) ui.root.dataset.cue = cue; else delete ui.root.dataset.cue;
    },
    perView: () => deps.layout.matches ? STORYBOOK.perViewPhone : STORYBOOK.perViewDesktop,
    views: new Map<number, PageView>(),
    spread: () => { const s = core.state; return s.kind === 'open' || s.kind === 'closing' ? s.spread : s.kind === 'turning' ? s.to : 0; },
    inView: () => spreadPages(core.spread(), core.perView(), core.pages.length).map(page => page === null ? null : view(page).root),
    paint: () => {
      ui.root.dataset.holo = core.look.tab;
      paintPicker(core.look, picker);
      const picked = picker.buttons.find(button => button.dataset.tab === core.look.tab);
      if (picked && core.look.tab !== core.revealed) { core.revealed = core.look.tab; fade.reveal(picked); } else fade.mark();
      for (const held of core.views.values()) for (const card of held.cards) {
        if (card.face.look) card.face.look.dataset.holo = tabHolo(core.look.tab, lookSeed(card.id, card.side));
      }
    },
    show: () => {
      const per = core.perView(), at = core.spread(), pages = spreadPages(at, per, core.pages.length).filter((page): page is number => page !== null);
      ui.root.dataset.view = per > 1 ? 'spread' : 'page';
      core.mark(core.state.kind);
      core.inView().forEach((page, side) => ui.ui.sides[side]!.replaceChildren(...(page ? [page] : [])));
      if (per === 1) ui.ui.sides[1]!.replaceChildren();
      ui.counter.textContent = STORYBOOK_COPY.pages(pages[0]! + 1, pages[pages.length - 1]! + 1, core.pages.length);
      ui.prev.disabled = core.state.kind !== 'open' || at === 0;
      ui.next.disabled = core.state.kind !== 'open' || at === spreadCount(core.pages.length, per) - 1;
      // A button that disables itself drops focus to the page body; hand it to a live control in the book instead.
      if ((document.activeElement as HTMLButtonElement | null)?.disabled) core.rest();
      core.paint();
    },
    /** Puts focus on Next, or on the close button when Next is disabled. Never on a disabled control. */
    rest: () => (ui.next.disabled ? ui.close : ui.next).focus(),
  };
  const view = (page: number) => {
    let held = core.views.get(page);
    if (!held) { held = pageView(core.pages[page]!, page, STORYBOOK.slotsPerPage, deps.face, openZoom); core.views.set(page, held); }
    return held;
  };
  const picker = holoPicker((action: BoardAction) => { core.look = boardStep(core.look, action, deps.reduced); core.paint(); }, 'storybook-picker', false);
  const fade = tabFade(picker.bar.children[0] as HTMLElement);
  ui.dock.append(ui.nav, picker.bar);
  return Object.assign(core, { stopFade: fade.stop });
}
type Core = ReturnType<typeof bookView>;

function showArriving(core: Core, art: StorybookDeps['art']): void {
  const { ui } = core;
  if (art) {
    if (!coverDecoded(art)) ui.root.dataset.coverHold = '';
    void loadArtInOrder(ui.root, art);
  }
  core.show();
  core.mark('arriving');
  ui.ui.front.focus({ focusVisible: false } as FocusOptions);
}

/** S6: the closed book's entrance over G15 `opening`, shown as `arriving` until it lands. */
function bookEntrance(core: Core, deps: StorybookDeps) {
  const { ui } = core, painter = flightPainter(ui);
  let flight: ReturnType<typeof flyIn> | null = null;
  const arriving = () => core.state.kind === 'opening' && ui.root.dataset.state === 'arriving';
  /** The flight is over (landed, skipped or cut by a close): the book at rest, the held painted cover free to fade in. */
  const settle = () => { flight = null; painter.clear(); delete ui.root.dataset.coverHold; };
  const land = () => { if (!arriving()) return; settle(); core.mark('closed'); }; // G15 `opening`, the closed book waits for its cover
  const fly = (origin?: Rect) => {
    const clock = deps.clock === undefined ? liveClock() : deps.clock;
    flight = flyIn(f => (f.landed ? land() : painter.paint(f)), origin ?? rectOf(deps.trigger), rectOf(ui.ui.cover), deps.reduced, clock);
    return flight.done;
  };
  /** A tap or key during the flight: the closed book at rest now, its open cue starting as after a normal landing. */
  const skip = () => { if (arriving()) flight?.toRest(); };
  const stop = () => { if (arriving()) { flight?.stop(); settle(); } };
  return { arriving, fly, skip, stop };
}

/** A document key listener for the book's keys when focus is outside it. A key inside the book already reached its own
 * listener; a key in an open dialog (the big card) is that dialog's, so its Escape closes the card, not the book. */
function keysOutside(root: HTMLElement, onKey: (event: Event) => void) {
  return (event: Event) => {
    const target = event.target as Element | null;
    if (root.contains?.(target as Node) || target?.closest?.('dialog[open]')) return;
    onKey(event);
  };
}

/** G15's moves with their motion: open (show the closed book), swing the cover, turn, resize, close. */
function bookMoves(core: Core, deps: StorybookDeps, onKey: (event: Event) => void) {
  const { ui } = core;
  /** While the book is up, its keys work wherever focus is. A key inside the book already reached its own listener. */
  const onDocumentKey = keysOutside(ui.root, onKey);
  let restore: (() => void) | null = null, pendingResize = false, was = core.perView();
  const relayout = () => {
    if (core.state.kind === 'turning') { pendingResize = true; return; } // G15: a resize mid-turn applies after turned
    pendingResize = false;
    core.send({ type: 'resize', was, perView: core.perView(), pages: core.pages.length });
    was = core.perView();
    core.show();
  };
  const turn = async (dir: 1 | -1) => {
    const old = core.inView();
    if (!core.send({ type: 'turn', dir, spreadCount: spreadCount(core.pages.length, core.perView()) })) return;
    core.mark(core.state.kind);
    await turnPages(ui.ui.sides, dir, old, core.inView(), deps.reduced);
    if (core.send({ type: 'turned' })) { if (pendingResize) relayout(); core.show(); }
  };
  const { arriving, fly, skip, stop } = bookEntrance(core, deps);
  /** S6: the closed book flies in from `origin` (default: the trigger's rect) and settles; `arriving` until it lands. */
  const open = async (origin?: Rect) => {
    if (core.state.kind !== 'closed') return;
    if (deps.art?.length) await coverOrTimeout(deps.art, STORYBOOK_LOAD.coverWaitMs); // fly the painted cover when it is near
    if (!core.send({ type: 'open' })) return;
    core.resetPages();
    restore = quietRoom(ui.root, deps.tray);
    document.body.append(ui.root);
    document.addEventListener('keydown', onDocumentKey);
    showArriving(core, deps.art);
    await fly(origin);
  };
  const swingOpen = async () => {
    if (core.state.kind !== 'opening' || ui.root.dataset.state !== 'closed') return;
    core.mark('opening');
    await swingCover(ui.ui, core.perView() > 1, deps.reduced, 'normal');
    if (core.send({ type: 'opened' })) { core.show(); core.rest(); }
  };
  const leave = () => { ui.root.remove(); restore?.(); restore = null; document.removeEventListener('keydown', onDocumentKey); };
  const close = async () => {
    const swung = !(core.state.kind === 'opening' && (ui.root.dataset.state === 'closed' || arriving()));
    stop(); // Escape mid-flight: no landing, straight out
    if (!core.send({ type: 'close' })) return;
    finishMotion();
    await Promise.resolve();
    core.show();
    if (swung) await swingCover(ui.ui, core.perView() > 1, deps.reduced, 'reverse');
    core.send({ type: 'closed' });
    leave();
    core.mark('closed');
    // Show focus on the entry point even after a pointer closes the book.
    deps.trigger.focus({ focusVisible: true } as FocusOptions);
  };
  return { relayout, turn, open, swingOpen, close, leave, skip, arriving };
}

/** The page. `open` puts the closed book up; the cover, arrows, swipe and keys do the rest. */
export function storybookPage(deps: StorybookDeps) {
  const core = bookView(deps, (card, button) => openZoom(card, button));
  const onKey = (event: Event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'Escape' && moves.arriving()) { event.preventDefault(); moves.skip(); return; } // any key lands the flight, nothing more
    if (key === 'Escape') { event.preventDefault(); void moves.close(); }
    if (key === 'ArrowRight') forward();
    if (key === 'ArrowLeft') void moves.turn(-1);
  };
  const moves = bookMoves(core, deps, onKey), { ui } = core;
  /** The big card opens on the tapped side (Normal, Cozy or Action), with that side's art and option pressed. */
  const openZoom = (card: PageCardData, button: HTMLButtonElement) => {
    if (!core.send({ type: 'zoom', id: card.id })) return;
    core.paint();
    const selected = 'made' in card ? deps.readMadeCards?.().find(item => item.id === card.id) ?? card.made : zoomCard(card.id);
    const recoverAlt = deps.recoverAlt;
    deps.zoom.open(selected, button, () => { core.send({ type: 'unzoom' }); core.paint(); },
      { holo: seed => tabHolo(core.look.tab, seed), animate: core.look.animate, side: card.side,
        ...(selected.kind === 'made' && !selected.art.alt && recoverAlt ? { recoverAlt: host => recoverAlt(selected.id, host) } : {}) });
  };
  const forward = () => void (core.state.kind === 'opening' ? moves.swingOpen() : moves.turn(1));
  ui.root.addEventListener('keydown', onKey);
  // A tap during the flight lands it and is spent there, so it never also opens the cover. The close button still closes.
  ui.root.addEventListener('click', event => {
    if (!moves.arriving() || event.target === ui.close || ui.close.contains?.(event.target as Node)) return;
    event.preventDefault(); event.stopPropagation(); moves.skip();
  }, true);
  ui.close.addEventListener('click', () => void moves.close());
  ui.ui.front.addEventListener('click', () => void moves.swingOpen());
  ui.prev.addEventListener('click', () => void moves.turn(-1));
  ui.next.addEventListener('click', () => void moves.turn(1));
  onSwipe(ui.ui.book, dir => (dir > 0 ? forward() : void moves.turn(-1)));
  deps.layout.addEventListener('change', moves.relayout);
  const dispose = () => {
    deps.layout.removeEventListener('change', moves.relayout);
    moves.leave();
    core.stopFade();
    for (const held of core.views.values()) held.dispose();
    core.views.clear();
  };
  return { root: ui.root, open: moves.open, swingOpen: moves.swingOpen, close: moves.close, turn: moves.turn, state: () => core.state, dispose };
}
