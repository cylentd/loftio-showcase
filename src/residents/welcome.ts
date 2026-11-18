import { dismissOnBackdrop, worldButton, worldDrawer } from '../world-ui';
import { WELCOME_COPY as COPY } from './welcome-copy';
import welcomeArt from '../art/welcome-envelope.webp';
import './welcome.css';

/** Presentation only: the session's ticket ledger already owns the allowance. */
export function welcomeCard(trigger: HTMLElement, build: () => void) {
  const card = worldDrawer(COPY.title, COPY.close);
  card.dialog.classList.remove('world-frame');
  card.dialog.classList.add('welcome-card');
  dismissOnBackdrop(card.dialog);
  const body = document.createElement('p'); body.textContent = COPY.body;
  body.id = 'resident-welcome-description'; card.dialog.setAttribute('aria-describedby', body.id);
  const tickets = document.createElement('div'); tickets.className = 'welcome-tickets'; tickets.setAttribute('aria-hidden', 'true');
  const hero = document.createElement('img'); hero.className = 'welcome-hero';
  hero.src = welcomeArt; hero.alt = ''; hero.draggable = false; tickets.append(hero);
  const actions = document.createElement('div'); actions.className = 'welcome-actions';
  let building = false;
  const primary = worldButton(COPY.build, () => { building = true; card.dialog.close(); });
  primary.classList.add('world-primary');
  const explore = worldButton(COPY.explore, () => card.dialog.close());
  // The drawer restores focus first. Opening Create afterwards keeps focus inside the new dialog.
  card.dialog.addEventListener('close', () => { if (building) { building = false; build(); } });
  actions.append(primary, explore); card.content.append(body); card.dialog.prepend(tickets); card.dialog.append(actions);
  return { open() { card.open(trigger); primary.focus(); }, dispose() { building = false; card.dialog.close(); card.dialog.remove(); } };
}
