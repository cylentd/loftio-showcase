import { dismissOnBackdrop, worldButton, worldDrawer, worldTabs } from '../world-ui';
import { CAST } from '../cast';
import { NAMES } from '../copy';
import { imageSource } from '../builder/image-source';
import type { BuilderState } from '../builder/controller';
import type { SavedCharacter } from '../builder/records';
import type { ResidentEntry } from './registry';
import { RESIDENT_COPY as COPY } from './copy';
import { icon } from '../icons';
import type { OriginalEntry } from './original-lineup';
import { arrivalNameField } from './name-field';

// In the loft: the house; Saved: a kept letter; Create: a new leaf. Same stroke family as Settings.
const TAB_ICONS = ['room', 'letter', 'leaf'] as const;

export function residentChrome() {
  const drawer = worldDrawer(COPY.title, COPY.close); drawer.dialog.classList.add('residents-drawer', 'world-modal');
  dismissOnBackdrop(drawer.dialog);
  const trigger = worldButton(COPY.title, () => drawer.open(trigger)); trigger.classList.add('residents-trigger');
  trigger.classList.add('room-action'); trigger.dataset.label = COPY.title;
  trigger.setAttribute('aria-label', COPY.title); trigger.replaceChildren(icon('residents'));
  document.body.append(trigger);
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const panels = COPY.tabs.map(() => { const panel = document.createElement('section'); panel.setAttribute('role', 'tabpanel'); return panel; });
  const tabs = worldTabs(COPY.tabs, selected => panels.forEach((panel, index) => { panel.hidden = index !== selected; }), TAB_ICONS);
  tabs.root.querySelectorAll('button').forEach((button, index) => {
    button.id = `residents-tab-${index}`; panels[index]!.id = `residents-panel-${index}`;
    button.setAttribute('aria-controls', panels[index]!.id); panels[index]!.setAttribute('aria-labelledby', button.id);
  });
  drawer.content.append(tabs.root, status, error, ...panels); tabs.select(0);
  return { drawer, trigger, status, error, panels };
}

function rosterCard(id: string, name: string, source: string, inRoom: boolean, change: () => void) {
  const item = document.createElement('article'); item.className = 'resident-card'; item.dataset.residentId = id;
  item.setAttribute('aria-label', name);
  const image = document.createElement('img'); image.src = source; image.alt = ''; image.loading = 'lazy';
  const label = document.createElement('p'); label.textContent = name;
  item.append(image, label, worldButton(inRoom ? COPY.remove : COPY.invite, change));
  return item;
}

export function renderResidents(panels: HTMLElement[], state: BuilderState, entries: ResidentEntry[], remove: (id: string) => void,
  reveal: (entry: ResidentEntry) => void, originals: OriginalEntry[], changeOriginal: (id: string, inRoom: boolean) => void) {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusedPanel = panels.slice(0, 2).find(panel => focused && panel.contains(focused));
  const focusedId = focused?.closest<HTMLElement>('[data-resident-id]')?.dataset.residentId;
  panels[0]!.replaceChildren(); panels[1]!.replaceChildren();
  for (const entry of originals) {
    const cast = CAST.find(member => member.id === entry.id)!;
    const card = () => rosterCard(entry.id, NAMES[entry.id] ?? entry.id, cast.art, entry.inRoom, () => changeOriginal(entry.id, !entry.inRoom));
    if (entry.inRoom) panels[0]!.append(card());
    panels[1]!.append(card());
  }
  for (const entry of entries) {
    const saved = state.kept.find(item => item.id === entry.savedId); if (!saved) continue;
    const card = () => rosterCard(entry.id, entry.name ?? saved.resolvedSelections.creature.label, imageSource(saved.image), entry.inRoom,
      entry.inRoom ? () => remove(entry.id) : () => reveal(entry));
    if (entry.inRoom) panels[0]!.append(card());
    panels[1]!.append(card());
  }
  if (!panels[0]!.childElementCount) panels[0]!.textContent = COPY.emptyLoft;
  if (!panels[1]!.childElementCount) panels[1]!.textContent = COPY.empty;
  if (focusedPanel) {
    const card = [...focusedPanel.querySelectorAll<HTMLElement>('[data-resident-id]')].find(item => item.dataset.residentId === focusedId);
    (card?.querySelector<HTMLButtonElement>('button') ?? focusedPanel.querySelector<HTMLButtonElement>('button')
      ?? document.getElementById(focusedPanel.getAttribute('aria-labelledby')!))?.focus();
  }
}

export function arrivalReveal(chrome: ReturnType<typeof residentChrome>, callbacks: {
  welcome(entry: ResidentEntry, saved: SavedCharacter, skip: boolean): Promise<void>;
  rename(id: string, name: string): void;
  later(id: string): void; failure(error: unknown): void;
}) {
  const arrival = worldDrawer(COPY.ready, COPY.close); arrival.dialog.classList.add('resident-reveal', 'world-modal');
  dismissOnBackdrop(arrival.dialog);
  return (entry: ResidentEntry, saved: SavedCharacter, reduced: boolean) => {
    if (document.querySelector('dialog[open]:not(.world-drawer)')) return;
    chrome.drawer.dialog.close();
    const skip = reduced; let joining = false;
    const image = document.createElement('img'); image.src = imageSource(saved.image); image.alt = saved.resolvedSelections.creature.label;
    image.className = 'arrival-peek';
    const basket = document.createElement('div'); basket.className = 'reveal-basket'; basket.append(image);
    const greeting = document.createElement('p'); greeting.textContent = COPY.greeting;
    const error = document.createElement('p'); error.setAttribute('role', 'alert');
    const failed = (failure: unknown) => { error.textContent = failure instanceof Error ? failure.message : COPY.actionFailure; callbacks.failure(failure); };
    const form = document.createElement('form'); form.className = 'resident-arrival-form';
    const naming = arrivalNameField(entry);
    const welcome = document.createElement('button'); welcome.type = 'submit';
    welcome.textContent = COPY.welcome; welcome.className = 'world-button world-primary';
    const persist = () => {
      const name = naming.read(); if (name === null) return null;
      callbacks.rename(entry.id, name); return { ...entry, name };
    };
    form.addEventListener('submit', event => {
      event.preventDefault(); if (joining) return;
      try {
        const named = persist(); if (!named) return;
        joining = true; naming.input.disabled = welcome.disabled = later.disabled = true;
        void callbacks.welcome(named, saved, skip).then(() => arrival.dialog.close()).catch(failed)
          .finally(() => { joining = false; naming.input.disabled = welcome.disabled = later.disabled = false; });
      } catch (failure) { failed(failure); }
    });
    const later = worldButton(COPY.later, () => {
      if (joining) return;
      try { if (!persist()) return; callbacks.later(entry.id); arrival.dialog.close(); } catch (failure) { failed(failure); }
    });
    // The body scrolls when the screen is short; the actions stay in a footer below it, always in view.
    const body = document.createElement('div'); body.className = 'reveal-body';
    body.append(basket, greeting, naming.field, error);
    if (saved.image.mime === 'image/webp') {
      const original = document.createElement('a'); original.href = saved.image.originalUrl; original.download = 'loftio-resident.png'; original.textContent = COPY.original;
      body.append(original);
    }
    const actions = document.createElement('div'); actions.className = 'reveal-actions';
    // Two choices only (owner, 2026-11-10). Closing keeps the basket waiting in the room, which is the redo.
    actions.append(welcome, later);
    form.append(body, actions);
    arrival.content.replaceChildren(form);
    arrival.open(chrome.trigger);
  };
}
