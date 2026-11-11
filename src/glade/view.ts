import './style.css';
import { GLADE } from './copy';
import { dismissOnBackdrop } from '../world-ui';
import { icon } from '../icons';
import { installGladeDeparture } from './departure';

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className: string, text?: string): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function playGlade(): { ready(): void } {
  const trigger = element('button', 'glade-sign room-action');
  trigger.dataset.label = GLADE.trigger;
  const appIcon = element('img', 'glade-app-icon');
  appIcon.src = new URL(GLADE.appIcon, document.baseURI).href; appIcon.alt = '';
  trigger.append(appIcon);
  trigger.type = 'button'; trigger.hidden = true;
  trigger.setAttribute('aria-label', GLADE.triggerLabel);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'glade-panel');
  const panel = element('dialog', 'glade-panel');
  panel.id = 'glade-panel'; panel.setAttribute('aria-labelledby', 'glade-title');
  const close = element('button', 'glade-close'); close.type = 'button';
  close.setAttribute('aria-label', GLADE.close); close.append(icon('close'));
  const title = element('h2', 'glade-title', GLADE.title); title.id = 'glade-title';
  const activity = element('article', 'glade-activity');
  const visual = element('div', 'glade-visual');
  const art = element('img', 'glade-art');
  art.src = new URL(GLADE.keyArt, document.baseURI).href; art.alt = GLADE.imageAlt; art.loading = 'lazy';
  art.width = 1254; art.height = 746;
  visual.append(art);
  const body = element('div', 'glade-activity-body');
  const play = element('a', 'glade-play', GLADE.play);
  play.href = new URL(GLADE.route, document.baseURI).href;
  installGladeDeparture(play);
  body.append(element('p', 'glade-description', GLADE.description), play);
  activity.append(visual, body); panel.append(title, close, activity);
  dismissOnBackdrop(panel);
  trigger.addEventListener('click', () => panel.showModal());
  close.addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  document.querySelector('.tray-items')!.prepend(trigger);
  document.body.append(panel);
  return { ready() { trigger.hidden = false; } };
}
