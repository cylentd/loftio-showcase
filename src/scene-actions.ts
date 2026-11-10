import "./tray.css";
import { SCENE_ACTIONS, TRAY } from "./copy";
import { icon } from "./icons";
import { TRAY_HOVER_REACH_PX, TRAY_MOBILE_QUERY, TRAY_PEEK_MS } from "./tray-data";
import { TrayModel, nearTray } from "./tray-model";
import type { SceneSettings } from "./scene-settings";

/** The Music tile: a toggle that shows or hides the player pill. */
function musicTile(toggle: () => void): HTMLButtonElement {
  const button = document.createElement("button"); button.type = "button"; button.className = "music-toggle room-action";
  button.setAttribute("aria-label", TRAY.music.name); button.title = TRAY.music.help; button.dataset.label = TRAY.music.label;
  button.append(icon("note"));
  button.addEventListener("click", toggle);
  return button;
}

/** The corner tray: one board with the player anchored below the Residents, Music, Postcard and Settings tiles.
 *  Tucked, only the player row shows; the tile row comes out on entry, near a mouse, on a tap or on keyboard focus.
 *  With Music turned off there is no player row, so a tucked board is a slim bar holding only Settings.
 *  The Music choice is saved with the other scene settings; it only shows or hides the row, never plays sound. */
export function mountSceneActions(player: HTMLElement, postcard: HTMLElement, settings: Pick<SceneSettings, "showPlayer" | "setPlayer">, residents: HTMLElement): { peek(): void } {
  const group = document.createElement("div"); group.className = "scene-actions";
  group.setAttribute("role", "group"); group.setAttribute("aria-label", SCENE_ACTIONS.label);
  const reveal = document.createElement("div"); reveal.className = "tray-reveal";
  const inner = document.createElement("div"); inner.className = "tray-items";
  const tray = new TrayModel(TRAY_PEEK_MS, settings.showPlayer);
  const mobile = matchMedia(TRAY_MOBILE_QUERY);
  tray.alwaysOpen = mobile.matches;
  const music = musicTile(() => { settings.setPlayer(tray.toggleMusic()); render(); });
  postcard.dataset.label = TRAY.postcard.label;
  const panel = document.querySelector<HTMLDetailsElement>(".scene-settings")!;
  panel.querySelector<HTMLElement>("summary")!.dataset.label = TRAY.settings.label;
  inner.append(residents, music, postcard, panel); reveal.append(inner);
  group.append(player, reveal);
  document.body.append(group);

  let timer = 0, swallowClick = false;
  const render = () => {
    const now = performance.now();
    group.dataset.open = String(tray.isOpen(now));
    group.dataset.music = String(tray.musicShown);
    group.dataset.tiles = tray.rows(now).tiles;
    music.setAttribute("aria-pressed", String(tray.musicShown));
    clearTimeout(timer);
    const wait = tray.msUntilPeekEnds(now);
    if (wait !== null) timer = window.setTimeout(render, wait);
  };
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const hovering = nearTray(event.clientX, event.clientY, group.getBoundingClientRect(), TRAY_HOVER_REACH_PX);
    if (hovering !== tray.hovering) { tray.hovering = hovering; render(); }
  });
  mobile.addEventListener("change", () => { tray.alwaysOpen = mobile.matches; tray.pressOutside(); render(); });
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
    if (group.contains(event.target as Node)) swallowClick = tray.press(performance.now(), event.pointerType !== "mouse", player.contains(event.target as Node));
    else tray.pressOutside();
    render();
  }, true);
  // Visible player controls act immediately; a press elsewhere on the tucked tray only reveals its tiles.
  group.addEventListener("click", (event) => {
    if (!swallowClick) return;
    swallowClick = false; event.preventDefault(); event.stopPropagation();
  }, true);
  // Settings, or the disc's song list, holds the tray out while open. toggle does not bubble, so listen in the capture phase.
  group.addEventListener("toggle", () => { tray.held = panel.open || group.querySelector(":popover-open") !== null; render(); }, true);
  render();
  return { peek() { tray.peek(performance.now()); render(); } };
}
