// The pause window: builds the DOM once, shows and hides it. It owns no decisions; pause.js says when.
import { PAUSE_COPY as C } from './pause-copy.mjs';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function controlsList(rows, cls) {
  const ul = el('ul', `pause-keys ${cls}`);
  for (const [input, does] of rows) { const li = el('li'); li.append(el('strong', '', input), el('span', '', does)); ul.append(li); }
  return ul;
}

export function createPauseView({ modes, onResume, onSound, onMode, onLoft }) {
  const root = el('div', 'pause'); root.hidden = true;
  const card = el('div', 'pause-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'pause-title');
  const title = el('h2', '', C.title); title.id = 'pause-title';
  const resume = el('button', 'pause-primary', C.resume); resume.type = 'button'; resume.addEventListener('click', onResume);
  const sound = el('button', 'pause-switch', C.sound); sound.type = 'button'; sound.setAttribute('role', 'switch');
  sound.addEventListener('click', onSound);
  const modeButtons = {};
  const modeList = el('div', 'pause-modes'); modeList.setAttribute('role', 'radiogroup'); modeList.setAttribute('aria-label', C.graphicsTitle);
  for (const name of modes) {
    const b = el('button', 'pause-mode'); b.type = 'button'; b.setAttribute('role', 'radio');
    b.append(el('strong', '', C.modes[name][0]), el('span', '', C.modes[name][1]));
    b.addEventListener('click', () => onMode(name)); modeButtons[name] = b; modeList.append(b);
  }
  const loft = el('button', 'pause-loft', C.backToLoft); loft.type = 'button'; loft.hidden = true; loft.addEventListener('click', onLoft);
  card.append(title, resume, el('h3', '', C.controlsTitle), controlsList(C.mouseRows, 'for-mouse'), controlsList(C.touchRows, 'for-touch'),
    el('h3', '', C.settingsTitle), sound, el('h4', '', C.graphicsTitle), modeList, el('p', 'pause-note', C.graphicsNote), loft);
  root.append(card);
  document.body.append(root);

  return {
    root, card, resume,
    show({ soundOn, mode, loftAvailable }) {
      sound.setAttribute('aria-checked', String(soundOn));
      for (const [n, b] of Object.entries(modeButtons)) b.setAttribute('aria-checked', String(n === mode));
      loft.hidden = !loftAvailable;
      root.hidden = false; card.scrollTop = 0; resume.focus();
    },
    hide() { root.hidden = true; },
    setSound(on) { sound.setAttribute('aria-checked', String(on)); },
  };
}
