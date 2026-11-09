import type { createBuilder } from '../builder/controller';
import type { BuilderMode } from '../builder/local-mode';
import { curatedOptions } from '../builder/curated';
import type { SelectionField } from '../builder/selections';
import { icon } from '../icons';
import { worldButton } from '../world-ui';
import { RESIDENT_COPY, WIZARD_COPY } from './copy';
import { createAction } from './create-action';
import { pickTile, type PickTile } from './pick-tile';
import { SUMMARY_STEP, WIZARD_FIELDS, createWizard } from './wizard';
import './wizard.css';

const PICK_HOLD_MS = 320; // the chosen card's hop (--wizard-hop in styles.css) plays out before the next question
// Use 1 ticket ignores taps this long after the question opens, so a double-tap on Bring to life can't answer it.
// Above the ~300-500 ms window browsers treat as a double-click.
const CONFIRM_ARM_MS = 600;
let formCount = 0;

/** A pick's picture: the felt figure, a palette swatch, the die for a surprise, or the name of an old pick. */
function picture(tile: PickTile): HTMLElement {
  if (tile.kind === 'image') { const img = document.createElement('img'); img.className = 'wizard-art'; img.src = tile.src; img.alt = ''; img.draggable = false; return img; }
  const art = document.createElement('span');
  if (tile.kind === 'die') { art.className = 'wizard-art wizard-die'; art.append(icon('dice')); }
  if (tile.kind === 'swatch') { art.className = 'wizard-art wizard-swatch'; art.dataset.palette = tile.palette; }
  if (tile.kind === 'text') { art.className = 'wizard-art wizard-named'; art.textContent = tile.label; }
  return art;
}

function label(text: string, className = 'wizard-label') {
  const span = document.createElement('span'); span.className = className; span.textContent = text; return span;
}

function card(field: SelectionField, id: string | null) {
  const tile = pickTile(field, id);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'wizard-card';
  button.append(picture(tile), label(tile.label)); return button;
}

/** One question: a labelled group with its heading (focus lands here on advance) and the progress dots. */
function stepSection(title: string, index: number, uid: string) {
  const section = document.createElement('section'); section.className = 'wizard-step'; section.setAttribute('role', 'group');
  const heading = document.createElement('h3'); heading.id = `${uid}-step-${index}`; heading.tabIndex = -1; heading.textContent = title;
  const progress = document.createElement('span'); progress.className = 'visually-hidden'; progress.id = `${heading.id}-progress`;
  progress.textContent = WIZARD_COPY.progress(Math.min(index + 1, WIZARD_FIELDS.length), WIZARD_FIELDS.length);
  section.setAttribute('aria-labelledby', heading.id); section.setAttribute('aria-describedby', progress.id);
  const dots = document.createElement('ol'); dots.className = 'wizard-dots'; dots.setAttribute('aria-hidden', 'true');
  WIZARD_FIELDS.forEach((_, dot) => { const item = document.createElement('li'); item.dataset.state = dot < index ? 'done' : dot === index ? 'now' : 'next'; dots.append(item); });
  const head = document.createElement('header'); head.className = 'wizard-head'; head.append(heading, dots, progress);
  section.append(head); return { section, heading };
}

/** grant adds a test ticket; passed in mock mode only, where images are free placeholders. */
export function residentForm(builder: ReturnType<typeof createBuilder>, mode: BuilderMode, grant?: () => void) {
  const uid = `resident-wizard-${formCount++}`;
  // Only the local worker can reattach to a request; elsewhere a failed build's button starts a new one.
  const action = (state: ReturnType<typeof builder.state>) => createAction({ ...state, resumable: mode === 'local' });
  const wizard = createWizard(builder, Math.random);
  const form = document.createElement('form'); form.className = 'resident-form resident-wizard';
  const cards: { button: HTMLButtonElement; field: SelectionField; value: string | null }[] = [];
  let pending = false;
  const hold = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : PICK_HOLD_MS;

  const steps = WIZARD_FIELDS.map((field, index) => {
    const { section, heading } = stepSection(WIZARD_COPY.steps[index]!, index, uid);
    const grid = document.createElement('div'); grid.className = 'wizard-cards'; grid.dataset.field = field;
    const ids: (string | null)[] = curatedOptions(field).map(option => option.id);
    if (field === 'palette') ids.push(null);
    for (const id of ids) {
      const button = card(field, id);
      button.addEventListener('click', () => pick(field, id, button));
      cards.push({ button, field, value: id }); grid.append(button);
    }
    section.append(grid); return { section, heading };
  });

  // The summary: a designer-toy box card holding the four picks (each jumps back to its question), the basket
  // while waiting, then Bring to life with its small print underneath.
  const summary = stepSection(WIZARD_COPY.summary, SUMMARY_STEP, uid);
  const picks = document.createElement('div'); picks.className = 'wizard-picks';
  const pickButtons = WIZARD_FIELDS.map((_, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wizard-pick';
    button.addEventListener('click', () => { wizard.goTo(index); show(true); }); picks.append(button); return button;
  });
  const basket = document.createElement('div'); basket.className = 'wizard-basket reveal-basket'; basket.setAttribute('aria-hidden', 'true');
  const notice = document.createElement('p'); notice.className = 'wizard-notice'; notice.textContent = RESIDENT_COPY.notice[mode];
  // The failure sits directly above the button that answers it: on a phone the drawer is scrolled to the button.
  const failure = document.createElement('p'); failure.className = 'resident-failure'; failure.setAttribute('role', 'alert');
  const submit = worldButton(RESIDENT_COPY.create, () => {}); submit.type = 'submit'; submit.classList.add('world-primary', 'wizard-make');
  // A started resident can't be stopped, so spending a ticket asks first, in Bring to life's place.
  const confirm = document.createElement('div'); confirm.className = 'wizard-confirm'; confirm.setAttribute('role', 'group');
  const question = document.createElement('p'); question.id = `${uid}-confirm`; question.tabIndex = -1;
  confirm.setAttribute('aria-labelledby', question.id);
  const yes = worldButton(RESIDENT_COPY.confirmYes, () => { if (!armed) return; confirming = false; void wizard.make(); });
  yes.classList.add('world-primary');
  const no = worldButton(RESIDENT_COPY.confirmNo, () => { confirming = false; update(); submit.focus(); });
  const choices = document.createElement('div'); choices.className = 'wizard-confirm-choices'; choices.append(no, yes);
  confirm.append(question, choices);
  let confirming = false, armed = false;
  let lastStatus = builder.state().status;
  // No tickets: this panel takes Bring to life's place, so there is no dead button to press.
  const out = document.createElement('div'); out.className = 'wizard-out'; out.setAttribute('role', 'status');
  const outTitle = document.createElement('p'); outTitle.className = 'wizard-out-title'; outTitle.textContent = RESIDENT_COPY.outOfTickets;
  const outBody = document.createElement('p'); outBody.textContent = RESIDENT_COPY.outOfTicketsBody;
  out.append(outTitle, outBody);
  const grantButton = grant ? worldButton(RESIDENT_COPY.grantTicket, () => { grant(); update(); }) : null;
  if (grantButton) out.append(grantButton);
  const ticketNote = document.createElement('p'); ticketNote.className = 'wizard-notice wizard-ticket-note';
  summary.section.append(picks, basket, failure, submit, confirm, out, ticketNote, notice);

  // Back and the dice sit together under the cards: the thumb's end of a phone sheet.
  const bar = document.createElement('div'); bar.className = 'wizard-bar';
  const back = worldButton(WIZARD_COPY.back, () => { wizard.back(); show(true); }); back.classList.add('wizard-back'); back.prepend(icon('previous'));
  const dice = worldButton('', () => roll()); dice.classList.add('wizard-dice');
  const face = document.createElement('span'); face.className = 'wizard-dice-face'; face.append(icon('dice'));
  const diceLabel = document.createElement('span'); diceLabel.textContent = WIZARD_COPY.surprise; dice.append(face, diceLabel);
  bar.append(back, dice);
  form.append(...steps.map(step => step.section), summary.section, bar);

  function pick(field: SelectionField, value: string | null, button: HTMLButtonElement) {
    if (pending || button.disabled) return;
    pending = true;
    for (const item of cards) if (item.field === field) item.button.setAttribute('aria-pressed', String(item.button === button));
    button.classList.add('is-picked');
    setTimeout(() => { button.classList.remove('is-picked'); pending = false; wizard.choose(value); show(true); }, hold());
  }
  function roll() {
    if (pending || dice.disabled) return;
    pending = true; dice.classList.add('is-rolling');
    setTimeout(() => { dice.classList.remove('is-rolling'); pending = false; wizard.surprise(); show(true); }, hold());
  }
  function show(focus: boolean) {
    const current = wizard.step;
    confirming = false; // leaving the summary drops an open question; the picks may change
    steps.forEach((step, index) => { step.section.hidden = index !== current; });
    summary.section.hidden = current !== SUMMARY_STEP;
    dice.hidden = current === SUMMARY_STEP;
    // The first question has nothing to go back to: Surprise me takes the whole bar instead of leaving a hole.
    bar.classList.toggle('is-first', current === 0);
    update();
    if (focus) (steps[current]?.heading ?? summary.heading).focus();
  }
  // A submit that would spend a ticket only opens the question; Use 1 ticket is the one way to start.
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!action(builder.state()).confirmBeforeCreate) { void wizard.make(); return; }
    if (confirming) return;
    confirming = true; armed = false; update(); question.focus({ preventScroll: true });
    // Centred, so the answer buttons clear the Back bar pinned to the bottom of a phone sheet.
    choices.scrollIntoView({ block: 'center' });
    setTimeout(() => { armed = true; update(); }, CONFIRM_ARM_MS);
  });

  function update() {
    const state = builder.state(); const busy = state.status === 'generating' || state.saving;
    // A creation already running (or resumed after reload) is shown where it was started: on the summary.
    if (busy && wizard.step !== SUMMARY_STEP) { wizard.goTo(SUMMARY_STEP); show(false); return; }
    // A finished resident waits in the loft's basket, so the panel starts a fresh design.
    const finished = lastStatus === 'generating' && state.status === 'ready'; lastStatus = state.status;
    if (finished) { wizard.restart(); show(false); return; }
    // A card shows as picked only after the user picked on that step, though the builder always holds a value.
    if (!pending) for (const { button, field, value } of cards) button.setAttribute('aria-pressed', String(wizard.chosen(field) && state.selections[field] === value));
    for (const { button } of cards) button.disabled = busy;
    WIZARD_FIELDS.forEach((field, index) => {
      const tile = pickTile(field, state.selections[field]); const button = pickButtons[index]!;
      button.classList.toggle('is-named', tile.kind === 'text');
      button.replaceChildren(picture(tile), label(tile.label), label(WIZARD_COPY.parts[index]!, 'wizard-part')); button.disabled = busy;
      button.setAttribute('aria-label', WIZARD_COPY.change(WIZARD_COPY.parts[index]!, tile.label));
    });
    const generating = state.status === 'generating';
    picks.hidden = generating; basket.hidden = !generating;
    if (generating && !basket.childElementCount) basket.append(picture(pickTile('creature', state.selections.creature)));
    if (!generating) basket.replaceChildren();
    // While waiting, the basket is the whole card: a started resident always finishes, so nothing to press.
    back.disabled = busy; dice.disabled = busy; back.hidden = generating || wizard.step === 0;
    submit.disabled = busy; notice.hidden = generating;
    const shown = action(state); submit.textContent = shown.label;
    if (failure.textContent !== shown.failure) failure.textContent = shown.failure;
    const asking = confirming && shown.confirmBeforeCreate;
    if (state.tickets) question.textContent = RESIDENT_COPY.confirmBuild(state.tickets);
    confirm.hidden = !asking; yes.disabled = busy || !armed; no.disabled = busy;
    submit.hidden = generating || shown.outOfTickets || asking; out.hidden = !shown.outOfTickets;
    if (grantButton) grantButton.disabled = busy;
    ticketNote.textContent = shown.ticketNote; ticketNote.hidden = generating || asking || !shown.ticketNote; // the question already says it
  }
  show(false); return { form, update };
}
