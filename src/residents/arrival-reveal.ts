import { dismissOnBackdrop, worldButton, worldDrawer } from '../world-ui';
import { imageSource } from '../builder/image-source';
import type { SavedCharacter } from '../builder/records';
import type { ResidentEntry } from './registry';
import type { residentChrome } from './view-parts';
import { RESIDENT_COPY as COPY } from './copy';
import { arrivalNameField } from './name-field';
import { unboxing } from './unboxing';
import type { RevealAudioPreference } from './unboxing-sound';
import { revealFlight } from './reveal-flight';

type ArrivalCallbacks = {
  welcome(entry: ResidentEntry, saved: SavedCharacter, skip: boolean): Promise<void>;
  rename(id: string, name: string): void;
  later(id: string): void;
  failure(error: unknown): void;
};

function arrivalActions(entry: ResidentEntry, saved: SavedCharacter, callbacks: ArrivalCallbacks, skip: () => boolean, close: () => void) {
  let joining = false;
  const form = document.createElement('form'); form.className = 'resident-arrival-form'; form.hidden = true;
  const naming = arrivalNameField(entry);
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const failed = (failure: unknown) => { error.textContent = failure instanceof Error ? failure.message : COPY.actionFailure; callbacks.failure(failure); };
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
      void callbacks.welcome(named, saved, skip()).then(close).catch(failed)
        .finally(() => { joining = false; naming.input.disabled = welcome.disabled = later.disabled = false; });
    } catch (failure) { failed(failure); }
  });
  const later = worldButton(COPY.later, () => {
    if (joining) return;
    try { if (!persist()) return; callbacks.later(entry.id); close(); } catch (failure) { failed(failure); }
  });
  const body = document.createElement('div'); body.className = 'reveal-body';
  body.append(naming.field, error);
  const actions = document.createElement('div'); actions.className = 'reveal-actions'; actions.append(welcome, later);
  form.append(body, actions);
  return { form, body, input: naming.input };
}

export function arrivalReveal(chrome: ReturnType<typeof residentChrome>, callbacks: ArrivalCallbacks, audio: RevealAudioPreference) {
  const arrival = worldDrawer(COPY.ready, COPY.close); arrival.dialog.classList.add('resident-reveal', 'world-modal');
  dismissOnBackdrop(arrival.dialog);
  let active: ReturnType<typeof unboxing> | null = null;
  let flight: ReturnType<typeof revealFlight>;
  let resumeAudio: (() => void) | undefined;
  const restoreAudio = () => { const resume = resumeAudio; resumeAudio = undefined; resume?.(); };
  const audioEnabled = () => audio.enabled ?? audio.playing;
  arrival.dialog.addEventListener('close', () => {
    flight?.dispose(); flight = undefined;
    active?.dispose(); active = null; delete arrival.dialog.dataset.cinema; delete arrival.dialog.dataset.framed;
    restoreAudio();
    if (document.activeElement === document.body) chrome.trigger.focus();
  });
  audio.subscribe(() => { if (!audioEnabled()) active?.mute(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) active?.mute(); });
  return (entry: ResidentEntry, saved: SavedCharacter, reduced: boolean, origin?: HTMLButtonElement) => {
    if (document.querySelector('dialog[open]:not(.world-drawer)')) return;
    const focused = document.activeElement;
    const trigger = origin ?? (focused instanceof HTMLButtonElement && focused.classList.contains('arrival-box') ? focused : chrome.trigger);
    arrival.dialog.dataset.handoff = 'false';
    delete arrival.dialog.dataset.framed;
    chrome.drawer.dialog.close();
    active?.dispose();
    flight?.dispose(); flight = undefined;
    restoreAudio();
    let skip = reduced;
    const actions = arrivalActions(entry, saved, callbacks, () => skip, () => arrival.dialog.close());
    const greeting = document.createElement('p'); greeting.textContent = COPY.greeting; greeting.hidden = true;
    const original = document.createElement('a'); original.hidden = true;
    if (saved.image.mime === 'image/webp') {
      original.href = saved.image.originalUrl; original.download = 'loftio-resident.png'; original.textContent = COPY.original;
    }
    const box = unboxing(imageSource(saved.image), entry.name ?? saved.resolvedSelections.creature.label, reduced, immediate => {
      if (!arrival.dialog.open) return;
      flight?.dispose(); flight = undefined;
      arrival.dialog.dataset.cinema = 'false';
      restoreAudio();
      skip = immediate; actions.form.hidden = greeting.hidden = false; original.hidden = saved.image.mime !== 'image/webp';
      actions.body.prepend(box.stage, greeting);
      actions.body.append(original);
      actions.input.focus({ preventScroll: true });
    }, audioEnabled, phase => {
      if (phase === 'loading') arrival.dialog.dataset.handoff = 'pending';
      if (phase === 'playing' || phase === 'retry') {
        arrival.dialog.dataset.handoff = 'true';
        if (phase === 'playing') flight?.finish(); else flight?.dispose();
      }
    }, () => flight?.ready ?? Promise.resolve());
    active = box;
    arrival.dialog.dataset.cinema = 'true';
    arrival.content.replaceChildren(box.stage, box.skip, greeting, actions.form, original);
    arrival.open(trigger);
    if (!reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches && entry.arrival === 'waiting') {
      flight = revealFlight(arrival.dialog, trigger, box.stage.querySelector('video')!);
    }
    if (!reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches && entry.arrival === 'waiting') resumeAudio = audio.suspend?.();
    box.open(entry.arrival !== 'waiting');
  };
}
