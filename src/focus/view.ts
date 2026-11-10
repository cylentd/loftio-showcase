import './styles.css';
import { dismissOnBackdrop, worldButton, worldDrawer } from '../world-ui';
import { controlText } from '../settings-components';
import { FOCUS_CARD_IDS, MAX_FOCUS_CARDS, focusCards, type FocusCards } from './cards';
import { FOCUS_COPY as COPY } from './copy';

// "Arrive. The room is already playing. Nothing asks for input." (LOFTIO-COMPANION.md, First 60 seconds):
// the picker waits this long after the title, and waits again while another panel is open.
const FIRST_ASK_DELAY_MS = 3000;

function picker(cards: FocusCards) {
  const drawer = worldDrawer(COPY.title, COPY.close); drawer.dialog.classList.add('focus-drawer', 'world-modal');
  dismissOnBackdrop(drawer.dialog);
  const intro = document.createElement('p'); intro.className = 'focus-intro'; intro.textContent = COPY.intro;
  const grid = document.createElement('div'); grid.className = 'focus-cards';
  grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', COPY.title);
  const status = document.createElement('p'); status.className = 'focus-status'; status.setAttribute('role', 'status');
  const later = document.createElement('p'); later.className = 'focus-later'; later.textContent = COPY.later;
  const finish = worldButton(COPY.skip, () => drawer.dialog.close()); finish.classList.add('world-primary', 'focus-finish');
  const buttons = FOCUS_CARD_IDS.map(id => {
    const button = worldButton('', () => { if (cards.toggle(id)) render(); });
    button.className = 'focus-card'; button.dataset.card = id;
    const label = document.createElement('span'); label.className = 'focus-label'; label.textContent = COPY.cards[id].label;
    const tiny = document.createElement('span'); tiny.className = 'focus-tiny'; tiny.textContent = COPY.cards[id].tiny;
    button.append(label, tiny);
    return button;
  });
  grid.append(...buttons);
  drawer.content.append(intro, grid, status, later, finish);
  function render() {
    const chosen = cards.chosen(); const full = chosen.length >= MAX_FOCUS_CARDS;
    for (const button of buttons) {
      const picked = chosen.includes(button.dataset.card as typeof chosen[number]);
      button.setAttribute('aria-pressed', String(picked)); button.disabled = full && !picked;
    }
    status.textContent = full ? COPY.full(MAX_FOCUS_CARDS) : COPY.count(chosen.length, MAX_FOCUS_CARDS);
    finish.textContent = chosen.length ? COPY.done : COPY.skip;
  }
  // Done, Skip, the close button and Escape all answer the question: the first-run picker never comes back by itself.
  drawer.dialog.addEventListener('close', () => cards.finish());
  // Another tab changed the picks: show them here too.
  addEventListener('storage', () => { if (drawer.dialog.open) render(); });
  return { open(from: HTMLElement) { render(); drawer.open(from); } };
}

/** The focus-card picker: asked once after the title on a first visit, and always reachable from Settings › Room. */
export function installFocusCards(settingsRoom: HTMLElement | null, shell: HTMLElement) {
  let cards: FocusCards;
  try {
    cards = focusCards({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  } catch { return { askOnce() {} }; }
  const view = picker(cards);
  if (settingsRoom) {
    const opener = worldButton(COPY.open, () => {
      const menu = opener.closest<HTMLDetailsElement>('details');
      if (menu) menu.open = false;
      opener.closest<HTMLDialogElement>('dialog')?.close();
      view.open(menu?.querySelector<HTMLElement>(':scope > summary') ?? opener);
    });
    // DESIGN.md: settings pair an icon with words. The leaf: what the cards grow in the room.
    controlText(opener, 'leaf', COPY.open); opener.classList.add('focus-open');
    settingsRoom.insertBefore(opener, settingsRoom.querySelector(':scope > .room-about'));
  }
  const busy = () => !!document.querySelector('dialog[open], details.scene-settings[open]');
  const ask = () => {
    if (cards.answered()) return;
    if (busy()) { window.setTimeout(ask, FIRST_ASK_DELAY_MS); return; }
    // Closing returns focus to the room, so the room must be able to take it.
    if (!shell.hasAttribute('tabindex')) shell.tabIndex = -1;
    view.open(shell);
  };
  return {
    /** Call once the person has passed the title. Does nothing on a return visit. */
    askOnce() { if (!cards.answered()) window.setTimeout(ask, FIRST_ASK_DELAY_MS); },
  };
}
