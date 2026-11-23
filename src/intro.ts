import { INTRO } from "./copy";
import { HINT_AT_MS } from "./intro-data";
import { buildIntro } from "./intro-build";

/** The title waits for a click, tap or key. That press is also the gesture browsers require before sound can play. */
export function installIntro(shell: HTMLElement, still: boolean) {
  const { element, status, hint, retry } = buildIntro(shell, still);
  const returning = document.documentElement.hasAttribute('data-loft-return');
  if (returning) {
    element.hidden = true;
    const url = new URL(location.href); url.searchParams.delete('from');
    history.replaceState(history.state, '', url.href);
  }
  let ready = false, failed = false, dismissed = false, skipRequested = returning;
  let onEnter = () => {};
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
