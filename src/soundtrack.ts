import { Soundtrack } from "./audio-model";
import { MUSIC } from "./copy";
import { TRACKS } from "./soundtrack-data";
import { makeAudioView } from "./soundtrack-view";
import { controlPanel } from "./controls";
import { controlText } from "./settings-components";

const DEFAULT_VOLUME = 0.35;

export function installSoundtrack(): Soundtrack {
  const audio = document.createElement("audio");
  const source = (file: string) => `${import.meta.env.BASE_URL}audio/${file}`;
  audio.src = source(TRACKS[0].file);
  audio.loop = false;
  audio.preload = "none";
  audio.volume = DEFAULT_VOLUME;
  const { details, summary, track, play, volume, status } = makeAudioView(DEFAULT_VOLUME);
  const model = new Soundtrack(audio, () => {
    controlText(play, model.desired ? "pause" : "play", model.desired ? MUSIC.pause : MUSIC.play);
    play.setAttribute("aria-pressed", String(model.desired));
    status.textContent = model.failed ? MUSIC.error : model.playing ? MUSIC.playing : MUSIC.paused;
  });
  const selectTrack = () => {
    const selected = TRACKS.find((entry) => entry.id === track.value)!;
    void model.select(source(selected.file));
  };
  play.addEventListener("click", () => { void model.toggle(); });
  volume.addEventListener("input", () => model.volume(volume.valueAsNumber));
  track.addEventListener("change", selectTrack);
  audio.addEventListener("ended", () => {
    const index = TRACKS.findIndex((entry) => entry.id === track.value);
    track.value = TRACKS[(index + 1) % TRACKS.length]!.id;
    selectTrack();
  });
  audio.addEventListener("error", () => model.fail());
  document.addEventListener("visibilitychange", () => { void model.visibility(document.hidden); });
  void model.visibility(document.hidden);
  details.append(audio);
  controlPanel("sound").append(details);
  return model;
}
