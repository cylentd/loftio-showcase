import { MUSIC } from "./copy";
import { icon } from "./icons";
import type { installRoomAudio } from "./room-audio";
import { makeSongWave } from "./song-wave";
import { makeTrackPicker } from "./track-picker";

/** The tray's music pill: the record (which opens the song list), the current song and where it is, the room sound's play/pause, and next. Volume stays in Settings → Sound. */
export function makeNowPlaying(audio: ReturnType<typeof installRoomAudio>, frozen: () => boolean): HTMLElement {
  const { playlist } = audio.music;
  const pill = document.createElement("div"); pill.className = "now-playing";
  pill.setAttribute("role", "group"); pill.setAttribute("aria-label", MUSIC.nowPlaying);
  const name = document.createElement("div"); name.className = "now-playing-name";
  const text = document.createElement("div"); text.className = "now-playing-text";
  const title = document.createElement("span"); title.className = "now-playing-title"; title.setAttribute("aria-live", "polite");
  text.append(title, makeSongWave(audio.music.model, audio.music.audio, frozen));
  // Picking from the list means "play this": music starts if it was paused. Rain keeps its own setting.
  const picker = makeTrackPicker(playlist, () => { if (!audio.music.model.desired) void audio.music.model.start(); });
  name.append(picker.disc, text);
  const next = document.createElement("button"); next.type = "button"; next.className = "music-next room-action";
  next.setAttribute("aria-label", MUSIC.next); next.title = MUSIC.next; next.append(icon("skip"));
  next.addEventListener("click", () => playlist.next());
  const sync = () => {
    title.textContent = MUSIC.tracks[playlist.current.id];
    pill.dataset.playing = String(audio.playing);
  };
  playlist.subscribe(sync); audio.subscribe(sync); sync();
  pill.append(name, picker.list, audio.button, next);
  return pill;
}
