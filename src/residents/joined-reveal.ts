import { imageSource } from '../builder/image-source';
import type { SavedCharacter } from '../builder/records';
import { parseLoadout } from '../loadout/loadout-model';
import { LOADOUT_COPY, type AbilityCopy } from '../loadout/loadout-copy';
import { worldButton } from '../world-ui';
import { FIRST_RESIDENT_COPY as COPY } from './first-resident-copy';
import { arrivalNameField } from './name-field';
import { residentName, suggestedName } from './names';
import type { ResidentEntry } from './registry';
import './joined-reveal.css';

export type JoinedReveal = {
  opened(): void | Promise<void>; rename(name: string): void | Promise<void>; play?: () => void;
  observe(update: (record: SavedCharacter) => void): () => void;
};

function movesLabel(saved: SavedCharacter) {
  const loadout = parseLoadout(saved.rumble);
  if (!loadout) return '';
  const synergies: Record<string, AbilityCopy | undefined> = LOADOUT_COPY.synergies;
  const specials: Record<string, AbilityCopy | undefined> = LOADOUT_COPY.specials;
  const ability = loadout.names?.[loadout.synergy] ?? synergies[loadout.synergy]?.name;
  const special = loadout.special && (loadout.names?.[loadout.special] ?? specials[loadout.special]?.name);
  return [ability, special].filter(Boolean).join(' · ');
}

function joinedFooter(play: JoinedReveal['play'], close: () => boolean) {
  const footer = document.createElement('footer'); footer.className = 'reveal-actions';
  if (play) {
    const action = worldButton(COPY.goPlay, () => { if (close()) play(); }); action.classList.add('world-primary'); footer.append(action);
  }
  footer.append(worldButton(COPY.stay, close)); return footer;
}

function nameChanged(draft: string, saved: string): boolean {
  try { return residentName(draft) !== saved; } catch { return true; }
}

export function joinedReveal(entry: ResidentEntry, saved: SavedCharacter, stage: HTMLElement, actions: JoinedReveal,
  close: () => boolean) {
  let name = entry.name ?? suggestedName(entry.id);
  let alternate = false;
  const root = document.createElement('section'); root.className = 'joined-reveal';
  const title = document.createElement('h2'); title.tabIndex = -1;
  const joined = document.createElement('p'); joined.className = 'joined-resident-status'; joined.setAttribute('role', 'status');
  const original = stage.querySelector<HTMLImageElement>('.unboxing-resident')!;
  let alt = saved.alt?.slot.status === 'ready' ? saved.alt.slot.image : null;
  const toggle = worldButton('', () => { if (alt) { alternate = !alternate; update(); } });
  const rename = worldButton(COPY.rename, () => { editor.hidden = false; rename.hidden = true; field.input.focus(); });
  const editor = document.createElement('form'); editor.hidden = true;
  const field = arrivalNameField({ ...entry, name });
  field.input.addEventListener('invalid', event => { event.preventDefault(); field.input.focus(); });
  const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'world-button'; submit.textContent = COPY.saveName;
  editor.append(field.field, submit);
  const closeEditor = () => {
    field.input.value = name; editor.hidden = true; rename.hidden = false; rename.focus();
  };
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || editor.hidden) return;
    const next = field.read(); if (!next) return;
    if (next === name) { closeEditor(); return; }
    submit.disabled = field.input.readOnly = true;
    try { const savedName = actions.rename(next); if (savedName) await savedName; name = next; }
    catch { field.showError(COPY.saveNameFailure); field.input.focus(); return; }
    finally { submit.disabled = field.input.readOnly = false; }
    update(); closeEditor();
  });
  const canDismiss = () => {
    if (submit.disabled) return false;
    if (editor.hidden || !nameChanged(field.input.value, name) || confirm(COPY.discardName)) return true;
    field.input.focus({ preventScroll: true }); return false;
  };
  function update() {
    title.textContent = COPY.meetName(name); joined.textContent = COPY.joined(name);
    original.alt = name;
    toggle.hidden = !alt;
    const source = imageSource(alternate && alt ? alt : saved.image);
    if (original.getAttribute('src') !== source) original.src = source;
    toggle.textContent = alternate ? COPY.originalArt : COPY.alternateArt;
    toggle.setAttribute('aria-label', alternate ? COPY.showOriginal(name) : COPY.showAlternate(name));
  }
  const moves = document.createElement('p'); moves.textContent = movesLabel(saved);
  const body = document.createElement('div'); body.className = 'reveal-body';
  const greeting = document.createElement('header'); greeting.className = 'joined-resident-greeting';
  greeting.append(title, rename);
  body.append(greeting, joined, editor, stage);
  body.append(toggle);
  if (moves.textContent) body.append(moves);
  root.append(body, joinedFooter(actions.play, close)); update();
  return { root, canDismiss, focus: () => title.focus({ preventScroll: true }), observe: () => actions.observe(record => {
    const next = record.alt?.slot.status === 'ready' ? record.alt.slot.image : null;
    if (next === alt) return;
    alt = next; if (!alt) alternate = false;
    update();
  }) };
}
