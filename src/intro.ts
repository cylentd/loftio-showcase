import { INTRO } from "./copy";
import { HINT_AT_MS, LEAVES, MOTES, VINE, VINE_PARTS, partClip, runClip } from "./intro-data";

function particle(className: string, vars: Record<string, string>): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(`--${name}`, value);
  return element;
}

// Art URLs are made absolute here: a relative url() in a custom property resolves against the bundled stylesheet in assets/.
function installAmbience(sign: HTMLElement, src: string) {
  const shade = sign.querySelector<HTMLElement>(".grove-intro-shade")!;
  shade.style.backgroundImage = `url("${src}")`;
  const vine = sign.querySelector<HTMLElement>(".grove-intro-vine")!;
  const vineVars = { art: `url("${new URL(VINE.art, document.baseURI).href}")`, x: `${VINE.x}%`, y: `${VINE.y}%`, width: `${VINE.width}%`, aspect: VINE.aspect };
  for (const [name, value] of Object.entries(vineVars)) vine.style.setProperty(`--vine-${name}`, value);
  vine.append(
    particle("grove-intro-vine-part is-run", { clip: runClip(VINE_PARTS) }),
    ...VINE_PARTS.map(part => particle(`grove-intro-vine-part is-${part.name}`, {
      clip: partClip(part), hang: `${part.hang[0]}% ${part.hang[1]}%`,
      breeze: `${part.breeze.deg}deg`, "breeze-time": `${part.breeze.seconds}s`, "breeze-delay": `${part.breeze.delay}s`,
    })),
  );
  const air = document.createElement("div");
  air.className = "grove-intro-air"; air.setAttribute("aria-hidden", "true");
  air.append(
    ...MOTES.map(m => particle("grove-intro-mote", { x: `${m.x}%`, y: `${m.y}%`, size: `${m.size}cqw`, dx: `${m.dx}cqw`, dy: `${m.dy}cqw`, duration: `${m.duration}s`, delay: `${m.delay}s`, peak: `${m.peak}` })),
    ...LEAVES.map(l => particle("grove-intro-leaf", { art: `url("${new URL(l.art, document.baseURI).href}")`, x: `${l.x}%`, y: `${l.y}%`, size: `${l.size}cqw`, sway: `${l.sway}cqw`, duration: `${l.duration}s`, delay: `${l.delay}s` })),
  );
  sign.append(air);
  return [shade, vine, air, sign.querySelector<HTMLElement>(".grove-intro-glow")!];
}

/** The title waits for a click, tap or key. That press is also the gesture browsers require before sound can play. */
export function installIntro(shell: HTMLElement, still: boolean) {
  const element = document.querySelector<HTMLElement>("#grove-intro")!;
  const status = element.querySelector<HTMLElement>(".grove-intro-status")!;
  const hint = element.querySelector<HTMLElement>(".grove-intro-hint")!;
  const sign = element.querySelector<HTMLElement>(".grove-intro-sign")!;
  const image = sign.querySelector<HTMLImageElement>("img")!;
  const fallback = element.querySelector<HTMLElement>(".grove-intro-name")!;
  const retry = element.querySelector<HTMLButtonElement>(".grove-intro-retry")!;
  const returning = document.documentElement.hasAttribute('data-loft-return');
  if (returning) {
    element.hidden = true;
    const url = new URL(location.href); url.searchParams.delete('from');
    history.replaceState(history.state, '', url.href);
  }
  let ready = false, failed = false, dismissed = false, skipRequested = returning;
  let onEnter = () => {};
  document.title = INTRO.pageTitle; shell.setAttribute("aria-busy", "true"); shell.inert = true;
  status.textContent = INTRO.loading; image.alt = INTRO.name; fallback.textContent = INTRO.name;
  retry.textContent = INTRO.retry;
  hint.textContent = matchMedia("(pointer: coarse)").matches ? INTRO.hintTouch : INTRO.hint;
  element.classList.toggle("is-still", still);
  const ambience = installAmbience(sign, image.src);
  const missingImage = () => { image.hidden = true; for (const layer of ambience) layer.hidden = true; fallback.hidden = false; };
  image.addEventListener("error", missingImage, { once: true });
  if (image.complete && !image.naturalWidth) missingImage();
  retry.addEventListener("click", () => location.reload());
  const dismiss = () => {
    if (!ready || dismissed) return;
    dismissed = true; document.removeEventListener("keydown", onKey, true);
    onEnter();
    const hadFocus = element.contains(document.activeElement);
    // The room is live as soon as the title starts leaving: the exit animation must not swallow the first grab.
    element.setAttribute("aria-hidden", "true"); element.classList.add("is-leaving"); shell.inert = false;
    const finish = () => {
      element.remove();
      if (hadFocus) { shell.tabIndex = -1; shell.focus({ preventScroll: true }); }
    };
    if (returning) { finish(); return; }
    const timer = window.setTimeout(finish, INTRO.cleanupMs);
    element.addEventListener("transitionend", event => {
      if (event.target !== element || event.propertyName !== "opacity") return;
      clearTimeout(timer); finish();
    });
  };
  const skip = () => { if (!failed) { skipRequested = true; dismiss(); } };
  const onKey = (event: KeyboardEvent) => {
    if (failed || event.repeat || !["Enter", " ", "Escape"].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); skip();
  };
  element.addEventListener("click", skip);
  document.addEventListener("keydown", onKey, true);
  return {
    /** The loft is drawn. `enter` runs once, when the person passes the title. */
    ready(enter: () => void = () => {}) {
      if (ready || failed) return;
      ready = true; onEnter = enter;
      shell.setAttribute("aria-busy", "false"); status.hidden = true;
      hint.style.animationDelay = `${Math.max(0, HINT_AT_MS - performance.now())}ms`;
      hint.hidden = false;
      if (skipRequested) dismiss();
    },
    fail() {
      if (ready || failed) return;
      failed = true; document.removeEventListener("keydown", onKey, true);
      element.hidden = false; delete document.documentElement.dataset.loftReturn;
      shell.setAttribute("aria-busy", "false"); status.textContent = INTRO.error; retry.hidden = false;
    },
  };
}
