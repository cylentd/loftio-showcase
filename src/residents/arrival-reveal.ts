import { dismissOnBackdrop, worldButton, worldDrawer } from '../world-ui';
import { imageSource } from '../builder/image-source';
import { parseLoadout } from '../loadout/loadout-model';
import { LOADOUT_COPY, type AbilityCopy } from '../loadout/loadout-copy';
import type { SavedCharacter } from '../builder/records';
import { hasParcel, type ResidentEntry } from './registry';
import type { residentChrome } from './view-parts';
import { RESIDENT_COPY as COPY } from './copy';
import { arrivalNameField } from './name-field';
import { unboxing } from './unboxing';
import type { RevealAudioPreference } from './unboxing-sound';
import { revealFlight } from './reveal-flight';
import { hasResidentCardArt } from './kept-residents';
import { FIRST_RESIDENT_COPY as FIRST } from './first-resident-copy';
import { launchControls, type FirstResidentLaunches } from './first-resident-launch';
import { joinedReveal, type JoinedReveal } from './joined-reveal';
import './first-resident.css';
import { attributesOf, clipLive, INITIAL, next, releasesAudio, releasesFlight, type DialogAttributes, type RevealEvent, type RevealState } from './arrival-reveal-model';

type ArrivalCallbacks = {
  welcome(entry: ResidentEntry, saved: SavedCharacter, skip: boolean): Promise<void>;
  rename(id: string, name: string): void | Promise<void>;
  later(id: string): unknown;
  failure(error: unknown): void;
  openCard(saved: SavedCharacter, name: string, trigger: HTMLButtonElement, reduced: boolean, first?: boolean): void;
};
type FirstReveal = { persist(name: string): unknown; collection(): void; launches?: FirstResidentLaunches };

function arrivalActions(entry: ResidentEntry, saved: SavedCharacter, callbacks: ArrivalCallbacks, skip: () => boolean, close: () => void, first: boolean) {
  let joining = false;
  let locked = false;
  const form = document.createElement('form'); form.className = 'resident-arrival-form'; form.hidden = true;
  const naming = arrivalNameField(entry);
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const failed = (failure: unknown) => { error.textContent = failure instanceof Error ? failure.message : COPY.actionFailure; callbacks.failure(failure); };
  const welcome = document.createElement('button'); welcome.type = 'submit';
  welcome.textContent = COPY.welcome; welcome.className = 'world-button world-primary';
  const persist = () => {
    const name = naming.read(); if (name === null) return null;
    const write = callbacks.rename(entry.id, name);
    const named = { ...entry, name };
    return write ? write.then(() => named) : named;
  };
  form.addEventListener('submit', event => {
    event.preventDefault(); if (joining || locked) return;
    try {
      const named = persist(); if (!named) return;
      joining = true; naming.input.disabled = welcome.disabled = later.disabled = true;
      void Promise.resolve(named).then(entry => callbacks.welcome(entry, saved, skip())).then(close).catch(failed)
        .finally(() => { joining = false; naming.input.disabled = welcome.disabled = later.disabled = false; });
    } catch (failure) { failed(failure); }
  });
  const later = worldButton(COPY.later, async () => {
    if (joining || locked) return;
    try { if (!await persist()) return; await callbacks.later(entry.id); close(); } catch (failure) { failed(failure); }
  });
  const body = document.createElement('div'); body.className = 'reveal-body';
  body.append(naming.field, error);
  const row = document.createElement('div'); row.className = 'reveal-actions'; row.append(welcome);
  if (first) welcome.classList.remove('world-primary'); else row.append(later);
  form.append(body, row);
  const lock = (busy: boolean) => { locked = busy; naming.input.disabled = welcome.disabled = later.disabled = busy; };
  return { form, body, row, input: naming.input, lock, name: naming.read, failed, joining: () => joining };
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

function firstRevealActions(config: FirstReveal, savedId: string, actions: ReturnType<typeof arrivalActions>, close: () => void) {
  const persist = () => {
    if (actions.joining()) return false;
    try {
      const name = actions.name(); if (name === null) return false;
      const write = config.persist(name);
      return write instanceof Promise ? write.then(() => true, failure => { actions.failed(failure); return false; }) : true;
    } catch (failure) { actions.failed(failure); return false; }
  };
  const collection = worldButton(FIRST.collection, async () => {
    if (collection.disabled) return;
    const result = persist();
    if (typeof result === 'boolean' ? result : await result) config.collection();
  });
  const launches = config.launches && launchControls(config.launches, savedId, persist, close, busy => {
    actions.lock(busy); collection.disabled = busy;
  });
  const footer = document.createElement('div'); footer.className = 'first-resident-footer';
  if (launches) footer.append(launches.root);
  actions.row.append(collection);
  footer.append(actions.row);
  return { footer, dispose: () => launches?.dispose() };
}

function residentCardPreview(saved: SavedCharacter, input: HTMLInputElement, button: HTMLButtonElement) {
  const heading = document.createElement('h3'); heading.textContent = FIRST.cardHeading;
  const group = document.createElement('section'); group.className = 'first-resident-card'; group.append(heading, button);
  const name = document.createElement('strong');
  const summary = document.createElement('span'); summary.className = 'first-resident-card-summary'; summary.append(name);
  const portrait = document.createElement('img'); portrait.alt = ''; portrait.src = imageSource(saved.image);
  button.textContent = ''; button.append(portrait, summary);
  const updateName = () => { name.textContent = FIRST.card(input.value.trim() || saved.resolvedSelections.creature.label); };
  input.addEventListener('input', updateName); updateName();
  const loadout = parseLoadout(saved.rumble);
  const ability = loadout && (LOADOUT_COPY.synergies as Record<string, AbilityCopy | undefined>)[loadout.synergy];
  if (ability) {
    const detail = document.createElement('span'); detail.textContent = ability.line;
    const title = document.createElement('strong'); title.textContent = loadout.names?.[loadout.synergy] ?? ability.name;
    summary.append(title, detail);
  }
  return group;
}

function beginUnboxing(dialog: HTMLDialogElement, trigger: HTMLButtonElement, entry: ResidentEntry, reduced: boolean,
  box: Box, driver: ReturnType<typeof revealDriver>, makeFlight: typeof revealFlight, audio: RevealAudioPreference) {
  const { handles, send } = driver;
  if (!reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches && hasParcel(entry)) {
    handles.flight = makeFlight(dialog, trigger, box.stage.querySelector('video')!, () => send({ type: 'landed' }));
    if (handles.flight) send({ type: 'flew' });
    handles.resume = audio.suspend?.();
    if (handles.resume) send({ type: 'held' });
  }
  box.open(!hasParcel(entry));
}

function watchRevealAudio(audio: RevealAudioPreference, quiet: () => void) {
  const enabled = () => audio.enabled ?? audio.playing;
  audio.subscribe(() => { if (!enabled()) quiet(); });
  const onHidden = () => { if (document.hidden) quiet(); };
  document.addEventListener('visibilitychange', onHidden);
  return { enabled, dispose: () => document.removeEventListener('visibilitychange', onHidden) };
}

function renderJoined(content: HTMLElement, entry: ResidentEntry, saved: SavedCharacter, stage: HTMLElement,
  joined: JoinedReveal, close: () => boolean, failure: ArrivalCallbacks['failure']) {
  const reveal = joinedReveal(entry, saved, stage, joined, close);
  content.replaceChildren(reveal.root); reveal.focus();
  try { void joined.opened()?.catch(failure); } catch (error) { failure(error); }
  return { unobserve: reveal.observe(), canDismiss: reveal.canDismiss };
}

export function arrivalReveal(chrome: ReturnType<typeof residentChrome>, callbacks: ArrivalCallbacks, audio: RevealAudioPreference, makeFlight: typeof revealFlight = revealFlight) {
  let firstActions: ReturnType<typeof firstRevealActions> | undefined, joinedActions: ReturnType<typeof renderJoined> | undefined;
  const endActions = () => { firstActions?.dispose(); firstActions = undefined; joinedActions?.unobserve(); joinedActions = undefined; };
  const arrival = worldDrawer(COPY.ready, COPY.close, () => joinedActions?.canDismiss() === false ? false : endActions()); arrival.dialog.classList.add('resident-reveal', 'world-modal');
  dismissOnBackdrop(arrival.dialog, arrival.dismiss);
  const driver = revealDriver(arrival.dialog), { handles, send, quiet } = driver;
  const revealAudio = watchRevealAudio(audio, quiet);
  arrival.dialog.addEventListener('close', () => {
    endActions();
    if (send({ type: 'close' }) && document.activeElement === document.body) chrome.trigger.focus();
  });
  const show = (entry: ResidentEntry, saved: SavedCharacter, reduced: boolean, origin?: HTMLButtonElement, first?: FirstReveal, joined?: JoinedReveal) => {
    if (document.querySelector('dialog[open]:not(.world-drawer)')) return;
    const focused = document.activeElement;
    const trigger = origin ?? (focused instanceof HTMLButtonElement && focused.classList.contains('arrival-box') ? focused : chrome.trigger);
    if (!send({ type: 'show' })) return;
    endActions();
    arrival.dialog.classList.toggle('first-resident-reveal', !!first || !!joined); arrival.dialog.classList.toggle('joined-resident-reveal', !!joined);
    chrome.drawer.dialog.close();
    handles.box?.dispose();
    let skip = reduced;
    const actions = arrivalActions(entry, saved, callbacks, () => skip, arrival.dismiss, !!first);
    const greeting = document.createElement('p'); greeting.textContent = COPY.greeting; greeting.hidden = true;
    const card = worldButton(COPY.viewCard, () => {
      const name = actions.input.value.trim() || entry.name || saved.resolvedSelections.creature.label;
      callbacks.openCard(saved, name, card, reduced, !!first);
    });
    const cardGroup = first && hasResidentCardArt(saved) ? residentCardPreview(saved, actions.input, card) : null;
    if (first) firstActions = firstRevealActions(first, entry.savedId, actions, arrival.dismiss);
    const original = document.createElement('a'); original.hidden = true;
    if (saved.image.mime === 'image/webp') {
      original.href = saved.image.originalUrl; original.download = 'loftio-resident.png'; original.textContent = COPY.original;
    }
    const box = unboxing(imageSource(saved.image), entry.name ?? saved.resolvedSelections.creature.label, reduced, immediate => {
      if (!arrival.dialog.open || !send({ type: 'opened' })) return;
      if (joined) { joinedActions = renderJoined(arrival.content, entry, saved, box.stage, joined, arrival.dismiss, callbacks.failure); return; }
      skip = immediate; actions.form.hidden = false; greeting.hidden = !!first; original.hidden = saved.image.mime !== 'image/webp';
      if (first) {
        actions.body.prepend(box.stage);
        if (cardGroup) actions.body.append(cardGroup);
        if (firstActions) actions.form.append(firstActions.footer);
      } else actions.body.prepend(box.stage, hasResidentCardArt(saved) ? card : greeting);
      actions.body.append(original);
      actions.input.focus({ preventScroll: true });
    }, revealAudio.enabled, phase => {
      if (phase === 'loading' || phase === 'playing' || phase === 'retry') send({ type: 'phase', phase });
    }, () => handles.flight?.ready ?? Promise.resolve());
    handles.box = box;
    arrival.content.replaceChildren(...(joined ? [box.stage, box.skip] : [box.stage, box.skip, greeting, actions.form, original]));
    arrival.open(trigger);
    beginUnboxing(arrival.dialog, trigger, entry, reduced, box, driver, makeFlight, audio);
  };
  const dispose = () => {
    if (!send({ type: 'dispose' })) return;
    endActions();
    revealAudio.dispose();
    arrival.dialog.close(); arrival.dialog.remove();
  };
  return Object.assign(show, { dispose, close: arrival.dismiss });
}
