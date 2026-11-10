import './style.css';
import { GLADE } from './copy';

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className: string, text?: string): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function playGlade(): { ready(): void } {
  const trigger = element('button', 'glade-sign', GLADE.trigger);
  trigger.type = 'button'; trigger.hidden = true;
  trigger.setAttribute('aria-label', GLADE.triggerLabel);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'glade-panel');
  const panel = element('dialog', 'glade-panel');
  panel.id = 'glade-panel'; panel.setAttribute('aria-labelledby', 'glade-title');
  const close = element('button', 'glade-close', GLADE.close); close.type = 'button';
  const logo = element('img', 'glade-logo');
  logo.src = new URL(GLADE.logo, document.baseURI).href; logo.alt = 'Loftio';
  logo.width = 1520; logo.height = 537; logo.loading = 'lazy';
  const title = element('h2', 'glade-title', GLADE.title); title.id = 'glade-title';
  const intro = element('p', 'glade-intro', GLADE.intro);
  const header = element('div', 'glade-header'); header.append(logo, close);
  const activity = element('article', 'glade-activity');
  const visual = element('div', 'glade-visual');
  const art = element('img', 'glade-art');
  art.src = new URL(GLADE.arena, document.baseURI).href; art.alt = GLADE.imageAlt; art.loading = 'lazy';
  const boss = element('img', 'glade-boss');
  boss.src = new URL(GLADE.boss, document.baseURI).href; boss.alt = ''; boss.loading = 'lazy';
  visual.append(art, boss);
  const body = element('div', 'glade-activity-body');
  const play = element('a', 'glade-play', GLADE.play);
  play.href = new URL(GLADE.route, document.baseURI).href;
  body.append(element('h3', 'glade-activity-title', GLADE.rumble), element('p', 'glade-description', GLADE.description), play);
  activity.append(visual, body); panel.append(header, title, intro, activity);
  trigger.addEventListener('click', () => panel.showModal());
  close.addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  document.body.append(trigger, panel);
  return { ready() { trigger.hidden = false; } };
}
