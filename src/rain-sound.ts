import { Soundtrack } from "./audio-model";
import { RAIN_SOUND as COPY } from "./copy";
import { RAIN_AUDIO, RAIN_SOURCE } from "./rain-audio-data";
import { controlPanel } from "./controls";
import { controlText } from "./settings-components";

export function installRainSound(): Soundtrack {
  const audio = document.createElement("audio");
  audio.preload = "none"; audio.loop = true; audio.volume = RAIN_AUDIO.volume;
  audio.src = import.meta.env.BASE_URL + RAIN_SOURCE;
  const details = document.createElement("section");
  details.className = "scene-rain";
  const summary = document.createElement("h3");
  controlText(summary, "rain", COPY.label);
  const panel = document.createElement("div");
  panel.className = "audio-panel";
  const play = document.createElement("button"); controlText(play, "play", COPY.play);
  const label = document.createElement("label"); label.textContent = COPY.volume;
  const volume = document.createElement("input");
  volume.type = "range"; volume.min = "0"; volume.max = "1"; volume.step = String(RAIN_AUDIO.volumeStep); volume.value = String(RAIN_AUDIO.volume);
  const status = document.createElement("p"); status.className = "rain-status"; status.textContent = COPY.paused;
  const model = new Soundtrack(audio, () => {
    controlText(play, model.desired ? "pause" : "play", model.desired ? COPY.pause : COPY.play);
    play.setAttribute("aria-pressed", String(model.desired));
    status.textContent = model.failed ? COPY.error : model.playing ? COPY.playing : COPY.paused;
  });
  play.setAttribute("aria-pressed", "false");
  play.addEventListener("click", () => {
    void model.toggle();
  });
  volume.addEventListener("input", () => model.volume(volume.valueAsNumber));
  audio.addEventListener("error", () => model.fail());
  document.addEventListener("visibilitychange", () => { void model.visibility(document.hidden); });
  addEventListener("pagehide", (event) => {
    void model.visibility(true);
  });
  addEventListener("pageshow", () => { void model.visibility(document.hidden); });
  void model.visibility(document.hidden);
  status.setAttribute("role", "status");
  label.append(volume); panel.append(play, label, status, audio); details.append(summary, panel);
  controlPanel("sound").append(details);
  return model;
}
