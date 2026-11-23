import { dismissOnBackdrop, worldButton, worldDrawer, worldTabs } from '../world-ui';
import { CAST } from '../cast';
import { NAMES } from '../copy';
import { imageSource } from '../builder/image-source';
import type { BuilderState } from '../builder/controller';
import type { ResidentEntry } from './registry';
import { RESIDENT_COPY as COPY } from './copy';
import { icon } from '../icons';
import type { OriginalEntry } from './original-lineup';

// In the loft: the house; Saved: a kept letter; Create: a new leaf. Same stroke family as Settings.
const TAB_ICONS = ['room', 'letter', 'leaf'] as const;
export type ResidentPortrait = { name: string; source: string; supported: boolean };
export type PortraitAction = { label: string; open(portrait: ResidentPortrait, trigger: HTMLElement): void };
/** What a card says about its resident to a room feature. `arrived`: welcomed into the loft at least once (a parcel is not);
 * `reroll` saves a new loadout and says whether it saved. */
export type ResidentCardFacts =
  | { kind: 'original'; id: string; name: string }
  | { kind: 'made'; id: string; savedId: string; name: string; arrived: boolean; rumble: unknown; reroll(): Promise<boolean> };
/** A room feature's extra block on each card, shown under the name; null shows nothing. */
export type CardDetail = (facts: ResidentCardFacts) => HTMLElement | null;
type CardDetails = { render: CardDetail; reroll(savedId: string): Promise<boolean> };
/** A feature's card detail wired to the builder: a reroll saved only when the builder resolves a new loadout (null is a refusal or a failed save). */
export const builderDetails = (render: CardDetail, builder: { reroll(id: string): Promise<unknown> }): CardDetails =>
  ({ render, reroll: id => builder.reroll(id).then(rolled => rolled !== null) });

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
  const tabs = worldTabs(COPY.tabs, selected => {
    panels.forEach((panel, index) => { panel.hidden = index !== selected; });
    drawer.dialog.dataset.panel = selected === 2 ? 'create' : 'residents';
  }, TAB_ICONS);
  tabs.root.querySelectorAll('button').forEach((button, index) => {
    button.id = `residents-tab-${index}`; panels[index]!.id = `residents-panel-${index}`;
    button.setAttribute('aria-controls', panels[index]!.id); panels[index]!.setAttribute('aria-labelledby', button.id);
  });
  drawer.content.append(tabs.root, status, error, ...panels); tabs.select(0);
  const openCreate = () => { tabs.select(2); if (!drawer.dialog.open) drawer.open(trigger); };
  return { drawer, trigger, status, error, panels, openCreate };
}

function rosterCard(id: string, name: string, source: string, inRoom: boolean, change: () => void, portrait?: PortraitAction, supported = true,
  detail: HTMLElement | null = null) {
  const item = document.createElement('article'); item.className = 'resident-card'; item.dataset.residentId = id;
  item.setAttribute('aria-label', name);
  const image = document.createElement('img'); image.src = source; image.alt = ''; image.loading = 'lazy';
  const label = document.createElement('p'); label.textContent = name;
  item.append(image, label);
  if (detail) item.append(detail);
  if (portrait) {
    const view = worldButton(portrait.label, () => portrait.open({ name, source, supported }, view));
    item.classList.add('resident-portrait-card'); item.append(view);
  }
  item.append(worldButton(inRoom ? COPY.remove : COPY.invite, change));
  return item;
}

export function renderResidents(panels: HTMLElement[], state: BuilderState, entries: ResidentEntry[], remove: (id: string) => void,
  reveal: (entry: ResidentEntry) => void, originals: OriginalEntry[], changeOriginal: (id: string, inRoom: boolean) => void, portrait?: PortraitAction,
  details?: CardDetails) {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusedPanel = panels.slice(0, 2).find(panel => focused && panel.contains(focused));
  const focusedCard = focused?.closest<HTMLElement>('[data-resident-id]');
  const focusedId = focusedCard?.dataset.residentId;
  const focusedIndex = focusedCard ? [...focusedCard.querySelectorAll('button')].indexOf(focused as HTMLButtonElement) : -1;
  panels[0]!.replaceChildren(); panels[1]!.replaceChildren();
  for (const entry of originals) {
    const cast = CAST.find(member => member.id === entry.id)!;
    const name = NAMES[entry.id] ?? entry.id;
    const card = () => rosterCard(entry.id, name, cast.art, entry.inRoom, () => changeOriginal(entry.id, !entry.inRoom), portrait, true,
      details?.render({ kind: 'original', id: entry.id, name }));
    if (entry.inRoom) panels[0]!.append(card());
    panels[1]!.append(card());
  }
  for (const entry of entries) {
    const saved = state.kept.find(item => item.id === entry.savedId); if (!saved) continue;
    const name = entry.name ?? saved.resolvedSelections.creature.label;
    const facts = { kind: 'made', id: entry.id, savedId: saved.id, name, arrived: entry.arrival === 'welcomed' && saved.state === 'kept',
      rumble: saved.rumble, reroll: () => details!.reroll(saved.id) } as const;
    const card = () => rosterCard(entry.id, name, imageSource(saved.image), entry.inRoom,
      entry.inRoom ? () => remove(entry.id) : () => reveal(entry), portrait, !saved.generation.providerId.includes('mock'), details?.render(facts));
    if (entry.inRoom) panels[0]!.append(card());
    panels[1]!.append(card());
  }
  if (!panels[0]!.childElementCount) panels[0]!.textContent = COPY.emptyLoft;
  if (!panels[1]!.childElementCount) panels[1]!.textContent = COPY.empty;
  if (focusedPanel) {
    // Focus returns to the same button of the same card (a Reroll keeps it), else the card's first, else the panel's.
    const card = [...focusedPanel.querySelectorAll<HTMLElement>('[data-resident-id]')].find(item => item.dataset.residentId === focusedId);
    (card?.querySelectorAll<HTMLButtonElement>('button')[focusedIndex] ?? card?.querySelector<HTMLButtonElement>('button')
      ?? focusedPanel.querySelector<HTMLButtonElement>('button')
      ?? document.getElementById(focusedPanel.getAttribute('aria-labelledby')!))?.focus();
  }
}
