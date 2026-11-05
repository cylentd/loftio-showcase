import "./tray.css";
import { SCENE_ACTIONS } from "./copy";
import { TRAY_HOVER_REACH_PX, TRAY_PEEK_MS } from "./tray-data";
import { TrayModel, nearTray } from "./tray-model";

/** The corner tray. Everything but Settings tucks behind it and comes out on entry, near a mouse, on a tap or on keyboard focus. */
export function mountSceneActions(items: HTMLElement[]): { peek(): void } {
  const group = document.createElement("div"); group.className = "scene-actions";
  group.setAttribute("role", "group"); group.setAttribute("aria-label", SCENE_ACTIONS.label);
  const reveal = document.createElement("div"); reveal.className = "tray-reveal";
  const inner = document.createElement("div"); inner.className = "tray-items";
  inner.append(...items); reveal.append(inner);
  const settings = document.querySelector<HTMLDetailsElement>(".scene-settings")!;
  group.append(reveal, settings);
  document.body.append(group);

  const tray = new TrayModel(TRAY_PEEK_MS);
  let timer = 0, swallowClick = false;
  const render = () => {
    const now = performance.now();
    group.dataset.open = String(tray.isOpen(now));
    clearTimeout(timer);
    const wait = tray.msUntilPeekEnds(now);
    if (wait !== null) timer = window.setTimeout(render, wait);
  };
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const hovering = nearTray(event.clientX, event.clientY, group.getBoundingClientRect(), TRAY_HOVER_REACH_PX);
    if (hovering !== tray.hovering) { tray.hovering = hovering; render(); }
  });
  document.documentElement.addEventListener("pointerleave", () => { if (tray.hovering) { tray.hovering = false; render(); } });
  // Only keyboard focus counts: a tapped button keeps focus, and that must not hold the tray out.
  const syncFocus = () => {
    const active = document.activeElement;
    tray.focused = !!active && group.contains(active) && active.matches(":focus-visible");
    render();
  };
  group.addEventListener("focusin", syncFocus);
  group.addEventListener("focusout", () => setTimeout(syncFocus));
  document.addEventListener("pointerdown", (event) => {
    if (group.contains(event.target as Node)) swallowClick = tray.press(performance.now(), event.pointerType !== "mouse");
    else tray.pressOutside();
    render();
  }, true);
  // A press on the tucked tray only brings it out; the control under the finger waits for the next press.
  group.addEventListener("click", (event) => {
    if (!swallowClick) return;
    swallowClick = false; event.preventDefault(); event.stopPropagation();
  }, true);
  settings.addEventListener("toggle", () => { tray.held = settings.open; render(); });
  render();
  return { peek() { tray.peek(performance.now()); render(); } };
}
