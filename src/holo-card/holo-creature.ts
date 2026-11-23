// The living resident on a holographic card (look round 3): it breathes from the feet, and on `greet` it hops and
// shows its welcome expression for a moment. Motion is transform-only. A resident with one image just hops.
// Reduced motion: no breath, no hop; the expression crossfades.
import { HOLO_LIFE, HOLO_PAT, type ExpressionOffset } from './constants';
import { nextGreetDelay } from './holo-card-model';

/** A resident's two card images and the offset that lines the expression up with the idle pose. */
export type ResidentArt = { idle: string; expression?: string; offset: ExpressionOffset; fit?: 'cutout' };

const PERCENT = 100;

function pose(className: string, src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = className;
  Object.assign(img, { src, alt, draggable: false });
  return img;
}

/** One hop: squash at the feet, stretch up and rise, settle. Scales are from the feet (CSS transform-origin). */
function hopFrames(): Keyframe[] {
  const { hopSquash, hopStretch, hopRise, hopSquashAt, hopStretchAt } = HOLO_LIFE;
  return [
    { transform: 'translateY(0) scale(1, 1)' },
    { offset: hopSquashAt, transform: `translateY(0) scale(${2 - hopSquash}, ${hopSquash})` },
    { offset: hopStretchAt, transform: `translateY(${-hopRise * PERCENT}%) scale(${2 - hopStretch}, ${hopStretch})` },
    { transform: 'translateY(0) scale(1, 1)' },
  ];
}

/** The creature's DOM: the root, its idle pose, and the welcome pose when the resident has an expression. */
function creatureBody(art: ResidentArt, alt: string) {
  const root = document.createElement('span');
  root.className = 'holo-creature';
  if (art.fit) root.dataset.fit = art.fit; // a cutout sprite is contained and centred, not cropped to the painting's ratio (CSS)
  root.style.setProperty('--holo-breath-ms', `${HOLO_LIFE.breathMs}ms`);
  root.style.setProperty('--holo-breath', `${HOLO_LIFE.breathScale}`);
  root.style.setProperty('--holo-bob', `${-HOLO_LIFE.bob * PERCENT}%`);
  const breath = document.createElement('span');
  breath.className = 'holo-breath';
  const idle = pose('holo-pose', art.idle, alt);
  breath.append(idle);
  const welcome = art.expression ? pose('holo-pose holo-pose-welcome', art.expression, '') : null;
  if (welcome) {
    const { x, y, scale } = art.offset;
    welcome.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
    welcome.setAttribute('aria-hidden', 'true');
    breath.append(welcome);
  }
  // The tap area rides inside the breath, so it moves with the body. CSS makes it live only on the popped card.
  const pat = document.createElement('span');
  pat.className = 'holo-pat';
  pat.style.inset = `${HOLO_PAT.top}% ${HOLO_PAT.side}% ${HOLO_PAT.bottom}%`;
  pat.style.borderRadius = `${HOLO_PAT.round}%`;
  breath.append(pat);
  root.append(breath);
  return { root, idle, welcome };
}

export function holoCreature(art: ResidentArt, alt: string, reduced: boolean) {
  const { root, idle, welcome } = creatureBody(art, alt);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (action: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); action(); }, ms); timers.add(t); };
  const show = (on: boolean) => {
    if (!welcome) return;
    if (reduced) {
      const fade = { duration: HOLO_LIFE.fadeMs, fill: 'forwards' as const };
      welcome.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], fade);
      idle.animate([{ opacity: on ? 1 : 0 }, { opacity: on ? 0 : 1 }], fade);
      return;
    }
    welcome.style.opacity = on ? '1' : '0';
    idle.style.opacity = on ? '0' : '1';
  };
  /** A hop, with the expression swapped where the squash hides it. */
  const hop = (on: boolean) => {
    if (reduced) { show(on); return; }
    root.animate(hopFrames(), { duration: HOLO_LIFE.hopMs, easing: 'ease-in-out' });
    later(() => show(on), HOLO_LIFE.hopMs * HOLO_LIFE.hopSquashAt);
  };
  const stop = () => {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    for (const animation of root.getAnimations({ subtree: true })) if (!(animation instanceof CSSAnimation)) animation.cancel();
    if (welcome) { welcome.style.opacity = '0'; idle.style.opacity = '1'; }
  };
  /** Hop into the welcome expression, hold it, hop back. */
  const greet = () => { stop(); hop(true); later(() => hop(false), HOLO_LIFE.greetMs); };
  // While live (the card popped out), the welcome repeats after a random wait counted from the end of the last hop.
  let live = false;
  const hopEnd = HOLO_LIFE.greetMs + (reduced ? HOLO_LIFE.fadeMs : HOLO_LIFE.hopMs);
  const schedule = (wait: number) => later(cycle, wait);
  function cycle() { greet(); schedule(hopEnd + nextGreetDelay(Math.random)); }
  // Breathing and the repeat hold while the page is hidden, so a background tab animates nothing nobody sees.
  const visibility = () => {
    root.classList.toggle('is-resting', document.hidden);
    if (document.hidden) stop();
    else if (live && timers.size === 0) schedule(nextGreetDelay(Math.random));
  };
  document.addEventListener('visibilitychange', visibility);
  visibility();
  return {
    root,
    /** Popped out: greet now and keep greeting; put back: stop. */
    setLive: (on: boolean) => { live = on; if (on && !document.hidden) cycle(); else stop(); },
    /** A tap on the resident: greet right away and restart the wait. */
    poke: () => { if (live && !document.hidden) cycle(); },
    stop,
    dispose: () => { live = false; stop(); document.removeEventListener('visibilitychange', visibility); },
  };
}
