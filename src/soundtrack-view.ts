import { MUSIC } from "./copy";
import { TRACKS } from "./soundtrack-data";
import { controlText } from "./settings-components";

export function makeAudioView(defaultVolume: number) {
  const details = document.createElement("section");
  details.className = "scene-audio";
  const summary = document.createElement("h3");
  controlText(summary, "sound", MUSIC.label);
  const panel = document.createElement("div");
  panel.className = "audio-panel";
  const trackLabel = document.createElement("label");
  trackLabel.textContent = MUSIC.track;
  const track = document.createElement("select");
  track.id = "scene-music-track";
  trackLabel.htmlFor = track.id;
  for (const entry of TRACKS) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = MUSIC.tracks[entry.id];
    track.append(option);
  }
  const play = document.createElement("button");
  play.type = "button";
  controlText(play, "play", MUSIC.play);
  play.setAttribute("aria-pressed", "false");
  const volumeLabel = document.createElement("label");
  volumeLabel.textContent = MUSIC.volume;
  const volume = document.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "1";
  volume.step = "0.01";
  volume.value = String(defaultVolume);
  volumeLabel.append(volume);
  const status = document.createElement("p");
  status.className = "audio-status";
  status.setAttribute("aria-live", "polite");
  status.textContent = MUSIC.paused;
  panel.append(trackLabel, track, play, volumeLabel, status);
  details.append(summary, panel);
  return { details, summary, track, play, volume, status };
}
