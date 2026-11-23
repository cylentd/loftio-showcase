import "./track-picker.css";
import { MUSIC } from "./copy";
import { icon } from "./icons";
import type { Playlist } from "./playlist-model";
import { TRACK_LIST } from "./track-picker-data";
import { TrackPicker, placeTrackList } from "./track-picker-model";

const LIST_ID = "track-list";

type Track = { readonly id: keyof typeof MUSIC.tracks };

function songRow(track: Track): HTMLButtonElement {
  const row = document.createElement("button"); row.type = "button"; row.className = "track-list-song";
  row.setAttribute("role", "menuitemradio"); row.tabIndex = -1; row.dataset.track = track.id;
  const name = document.createElement("span"); name.textContent = MUSIC.tracks[track.id];
  row.append(icon("note"), name);
  return row;
}

/** Runs `step` once per animation frame while it returns true. `start` cancels a loop already queued, so there is only ever one; `stop` cancels the queued frame. */
function frameLoop(step: () => boolean) {
  let frame = 0;
  const run = () => { frame = step() ? requestAnimationFrame(run) : 0; };
  return {
    start() { cancelAnimationFrame(frame); run(); },
    stop() { cancelAnimationFrame(frame); frame = 0; },
  };
}

/** The record button that opens the song list. */
function makeDisc(): HTMLButtonElement {
  const disc = document.createElement("button"); disc.type = "button"; disc.className = "now-playing-disc room-action";
  disc.setAttribute("aria-label", MUSIC.chooseSong); disc.title = MUSIC.chooseSong;
  disc.setAttribute("aria-haspopup", "menu"); disc.setAttribute("aria-controls", LIST_ID); disc.setAttribute("aria-expanded", "false");
  disc.append(icon("note"));
  return disc;
}

/** The manual-popover menu that holds the song rows. */
function makeList(rows: HTMLElement[]): HTMLElement {
  const list = document.createElement("div"); list.id = LIST_ID; list.className = "track-list";
  list.setAttribute("role", "menu"); list.setAttribute("aria-label", MUSIC.songList); list.popover = "manual";
  list.append(...rows);
  return list;
}

/** The list's keyboard handler: arrows move, Enter or Space pick, Escape closes. */
function listKeyHandler(picker: TrackPicker, pick: (index: number) => void, close: (returnFocus: boolean) => void, render: () => void) {
  return (event: KeyboardEvent) => {
    const action = picker.key(event.key);
    if (action.kind === "none") return;
    // Tab keeps its default: focus goes back to the disc first, so Tab carries on from there to the next control.
    if (event.key !== "Tab") { event.preventDefault(); event.stopPropagation(); }
    if (action.kind === "pick") pick(action.index);
    else if (action.kind === "close") close(true);
    else render();
  };
}

/** The record beside the song title, as a button that opens the song list above it.
 *  Picking a song selects it in the one Playlist (Settings → Sound and the title follow from there) and calls `onPick`, which starts the music.
 *  The list is a manual popover, so it sits in the top layer above the room and this module decides when it closes. */
export function makeTrackPicker<T extends Track>(playlist: Playlist<T>, onPick: () => void): { disc: HTMLButtonElement; list: HTMLElement } {
  const tracks = playlist.all;
  const picker = new TrackPicker(tracks.length);
  const disc = makeDisc();
  const rows = tracks.map(songRow);
  const list = makeList(rows);

  const currentIndex = () => tracks.indexOf(playlist.current);
  const place = () => {
    const margin = TRACK_LIST.marginPx;
    const view = { width: document.documentElement.clientWidth, height: window.innerHeight };
    list.style.maxWidth = `${view.width - 2 * margin}px`; list.style.maxHeight = `${view.height - 2 * margin}px`;
    const size = list.getBoundingClientRect();
    const at = placeTrackList(disc.getBoundingClientRect(), size, view, TRACK_LIST.gapPx, margin);
    list.style.left = `${at.left}px`; list.style.top = `${at.top}px`;
  };
  // The tray slides its tile row out under the player, which lifts the disc; the list rides along until it closes.
  let lastTop = NaN;
  const follow = frameLoop(() => {
    if (!picker.open) return false;
    const top = disc.getBoundingClientRect().top;
    if (top !== lastTop) { lastTop = top; place(); }
    return true;
  });
  const render = () => {
    disc.setAttribute("aria-expanded", String(picker.open));
    const current = playlist.current.id;
    rows.forEach((row, index) => {
      row.setAttribute("aria-checked", String(row.dataset.track === current));
      row.tabIndex = index === picker.active ? 0 : -1;
    });
    if (picker.open && !list.matches(":popover-open")) { list.showPopover(); lastTop = NaN; follow.start(); }
    if (!picker.open && list.matches(":popover-open")) { follow.stop(); list.hidePopover(); }
    if (picker.open) rows[picker.active]!.focus();
  };
  const close = (returnFocus: boolean) => { picker.hide(); render(); if (returnFocus) disc.focus(); };
  // A pick plays the song and leaves the list open, so a listener can try one after another.
  const pick = (index: number) => { picker.active = index; playlist.select(tracks[index]!.id); onPick(); render(); };

  disc.addEventListener("click", () => { picker.toggle(currentIndex()); render(); });
  disc.addEventListener("keydown", (event) => {
    if (picker.key(event.key).kind !== "open") return;
    event.preventDefault(); picker.show(currentIndex()); render();
  });
  list.addEventListener("keydown", listKeyHandler(picker, pick, close, render));
  rows.forEach((row, index) => row.addEventListener("click", () => pick(index)));
  // A press anywhere but the list or the disc closes it; the disc's own click already toggles.
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (picker.open && !list.contains(target) && !disc.contains(target)) close(false);
  }, true);
  window.addEventListener("resize", () => { if (picker.open) place(); });
  playlist.subscribe(render);
  render();
  return { disc, list };
}
