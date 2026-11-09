import { Soundtrack } from "./audio-model";
import { MUSIC } from "./copy";
import { Playlist, openingTrack } from "./playlist-model";
import { START_TRACK, START_TRACK_CHANCE, TRACKS } from "./soundtrack-data";
import { makeAudioView } from "./soundtrack-view";
import { controlPanel } from "./controls";
import { controlText } from "./settings-components";

const DEFAULT_VOLUME = 0.35;

export function installSoundtrack(): { model: Soundtrack; playlist: Playlist<(typeof TRACKS)[number]>; audio: HTMLAudioElement } {
  const audio = document.createElement("audio");
  const source = (file: string) => `${import.meta.env.BASE_URL}audio/${file}`;
  const playlist = new Playlist(TRACKS, openingTrack(TRACKS.map(track => track.id), START_TRACK, START_TRACK_CHANCE, Math.random()));
  audio.src = source(playlist.current.file);
  audio.loop = false;
  audio.preload = "none";
  audio.volume = DEFAULT_VOLUME;
  const { details, summary, track, play, volume, status } = makeAudioView(DEFAULT_VOLUME);
  track.value = playlist.current.id;
  const model = new Soundtrack(audio, () => {
    controlText(play, model.desired ? "pause" : "play", model.desired ? MUSIC.pause : MUSIC.play);
    play.setAttribute("aria-pressed", String(model.desired));
    status.textContent = model.failed ? MUSIC.error : model.playing ? MUSIC.playing : MUSIC.paused;
  });
  playlist.subscribe(() => {
    track.value = playlist.current.id;
    void model.select(source(playlist.current.file));
  });
  play.addEventListener("click", () => { void model.toggle(); });
  volume.addEventListener("input", () => model.volume(volume.valueAsNumber));
  track.addEventListener("change", () => playlist.select(track.value));
  audio.addEventListener("ended", () => playlist.next());
  audio.addEventListener("error", () => model.fail());
  document.addEventListener("visibilitychange", () => { void model.visibility(document.hidden); });
  void model.visibility(document.hidden);
  details.append(audio);
  controlPanel("sound").append(details);
  return { model, playlist, audio };
}
