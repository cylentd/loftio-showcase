import type { Soundtrack } from "./audio-model";
import { ROOM_AUDIO } from "./copy";
import { icon } from "./icons";
import { installSoundtrack } from "./soundtrack";
import { installRainSound } from "./rain-sound";

/** How long sound takes to fade up after the title, matched to the title's 1.2 s exit so the room and its sound arrive together. */
const ENTER_FADE_MS = 1500;

function fadeIn(tracks: Soundtrack[]): void {
  for (const track of tracks) track.beginFade();
  const started = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / ENTER_FADE_MS);
    for (const track of tracks) track.fadeStep(progress);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function installRoomAudio() {
  const music = installSoundtrack();
  const tracks = [music.model, installRainSound()];
  const button = document.createElement("button"); button.className = "room-audio room-action"; button.type = "button";
  const sync = () => {
    const playing = tracks.some(track => track.playing);
    button.replaceChildren(icon(playing ? "pause" : "play"));
    button.setAttribute("aria-label", playing ? ROOM_AUDIO.mute : ROOM_AUDIO.enable);
    button.setAttribute("aria-pressed", String(playing));
    button.title = tracks.some(track => track.failed) ? ROOM_AUDIO.blocked : playing ? ROOM_AUDIO.mute : ROOM_AUDIO.enable;
  };
  const removeUnlock = () => {
    document.removeEventListener("click", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  };
  const start = async (selected = tracks) => {
    button.disabled = true;
    await Promise.all(selected.map(track => track.start()));
    button.disabled = false; sync();
    if (tracks.every(track => !track.failed)) removeUnlock();
  };
  const retryBlocked = (fade = false) => {
    const blocked = tracks.filter(track => track.failed);
    if (!blocked.length) return;
    removeUnlock();
    if (fade) fadeIn(blocked);
    void start(blocked);
  };
  const unlock = (event: Event) => {
    if (!event.isTrusted || event instanceof KeyboardEvent && (event.repeat || !["Enter", " "].includes(event.key))) return;
    // The title hands over its own press (with a fade) through `unlock`, so its clicks are not ours.
    if (event.target instanceof Element && event.target.closest(".room-audio, #settings-sound, #grove-intro")) return;
    retryBlocked();
  };
  button.addEventListener("click", () => {
    if (tracks.some(track => track.playing)) void Promise.all(tracks.map(track => track.stop()));
    else void start();
  });
  for (const track of tracks) track.subscribe(sync);
  document.addEventListener("click", unlock, true);
  document.addEventListener("keydown", unlock, true);
  sync(); void start();
  // Passing the title is a user gesture, so sound the browser blocked on load can start then, fading up with the room.
  // The play button and playlist go to the now-playing pill in the corner tray.
  return {
    unlock: () => retryBlocked(true), button, music,
    subscribe(listener: () => void) { for (const track of tracks) track.subscribe(listener); },
    get playing() { return tracks.some(track => track.playing); },
  };
}
