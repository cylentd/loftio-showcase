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
import { hasResidentCardArt } from './kept-residents';
import { attributesOf, clipLive, INITIAL, next, releasesAudio, releasesFlight, type DialogAttributes, type RevealEvent, type RevealState } from './arrival-reveal-model';

type ArrivalCallbacks = {
  welcome(entry: ResidentEntry, saved: SavedCharacter, skip: boolean): Promise<void>;
  rename(id: string, name: string): void;
  later(id: string): void;
  failure(error: unknown): void;
  openCard(saved: SavedCharacter, name: string, trigger: HTMLButtonElement, reduced: boolean): void;
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

type Box = ReturnType<typeof unboxing>;
type Flight = ReturnType<typeof revealFlight>;
type Handles = { box: Box | null; flight: Flight; resume: (() => void) | undefined };

function writeAttributes(dataset: DOMStringMap, attributes: DialogAttributes) {
  for (const [key, value] of Object.entries(attributes)) { if (value === null) delete dataset[key]; else dataset[key] = value; }
}

/** Holds the lifecycle state and the three things it governs: the box, the flight layer and the audio resume. */
function revealDriver(dialog: HTMLDialogElement) {
  let state: RevealState = INITIAL;
  const handles: Handles = { box: null, flight: undefined, resume: undefined };
  // Sends an event; returns false when the model refused it. The model names each effect, this performs it.
  const send = (event: RevealEvent): boolean => {
    const before = state; state = next(before, event);
    if (state === before) return false;
    if (releasesFlight(before, state)) { handles.flight?.dispose(); handles.flight = undefined; }
    if (releasesAudio(before, state)) { const resume = handles.resume; handles.resume = undefined; resume?.(); }
    if (state.kind === 'idle' || state.kind === 'disposed') { handles.box?.dispose(); handles.box = null; }
    writeAttributes(dialog.dataset, attributesOf(state));
    return true;
  };
  return { handles, send, quiet: () => { if (clipLive(state)) handles.box?.mute(); } };
}

export function arrivalReveal(chrome: ReturnType<typeof residentChrome>, callbacks: ArrivalCallbacks, audio: RevealAudioPreference, makeFlight: typeof revealFlight = revealFlight) {
  const arrival = worldDrawer(COPY.ready, COPY.close); arrival.dialog.classList.add('resident-reveal', 'world-modal');
  dismissOnBackdrop(arrival.dialog);
  const { handles, send, quiet } = revealDriver(arrival.dialog);
  const audioEnabled = () => audio.enabled ?? audio.playing;
  arrival.dialog.addEventListener('close', () => {
    if (send({ type: 'close' }) && document.activeElement === document.body) chrome.trigger.focus();
  });
  audio.subscribe(() => { if (!audioEnabled()) quiet(); });
  const onHidden = () => { if (document.hidden) quiet(); };
  document.addEventListener('visibilitychange', onHidden);
  const show = (entry: ResidentEntry, saved: SavedCharacter, reduced: boolean, origin?: HTMLButtonElement) => {
    if (document.querySelector('dialog[open]:not(.world-drawer)')) return;
    const focused = document.activeElement;
    const trigger = origin ?? (focused instanceof HTMLButtonElement && focused.classList.contains('arrival-box') ? focused : chrome.trigger);
    if (!send({ type: 'show' })) return;
    chrome.drawer.dialog.close();
    handles.box?.dispose();
    let skip = reduced;
    const actions = arrivalActions(entry, saved, callbacks, () => skip, () => arrival.dialog.close());
    const greeting = document.createElement('p'); greeting.textContent = COPY.greeting; greeting.hidden = true;
    const card = worldButton(COPY.viewCard, () => {
      const name = actions.input.value.trim() || entry.name || saved.resolvedSelections.creature.label;
      callbacks.openCard(saved, name, card, reduced);
    });
    const original = document.createElement('a'); original.hidden = true;
    if (saved.image.mime === 'image/webp') {
      original.href = saved.image.originalUrl; original.download = 'loftio-resident.png'; original.textContent = COPY.original;
    }
    const box = unboxing(imageSource(saved.image), entry.name ?? saved.resolvedSelections.creature.label, reduced, immediate => {
      if (!arrival.dialog.open || !send({ type: 'opened' })) return;
      skip = immediate; actions.form.hidden = greeting.hidden = false; original.hidden = saved.image.mime !== 'image/webp';
      actions.body.prepend(box.stage, hasResidentCardArt(saved) ? card : greeting);
      actions.body.append(original);
      actions.input.focus({ preventScroll: true });
    }, audioEnabled, phase => {
      if (phase === 'loading' || phase === 'playing' || phase === 'retry') send({ type: 'phase', phase });
    }, () => handles.flight?.ready ?? Promise.resolve());
    handles.box = box;
    arrival.content.replaceChildren(box.stage, box.skip, greeting, actions.form, original);
    arrival.open(trigger);
    if (!reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches && entry.arrival === 'waiting') {
      handles.flight = makeFlight(arrival.dialog, trigger, box.stage.querySelector('video')!, () => send({ type: 'landed' }));
      if (handles.flight) send({ type: 'flew' });
      handles.resume = audio.suspend?.();
      if (handles.resume) send({ type: 'held' });
    }
    box.open(entry.arrival !== 'waiting');
  };
  // Tears the reveal down for good: closes the dialog, gives the audio back once and stops listening to the page.
  const dispose = () => {
    if (!send({ type: 'dispose' })) return;
    document.removeEventListener('visibilitychange', onHidden);
    arrival.dialog.close(); arrival.dialog.remove();
  };
  return Object.assign(show, { dispose });
}
