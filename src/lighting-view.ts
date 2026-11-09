import { controlPanel } from "./controls";
import { LIGHTING_COPY } from "./copy";
import { LIGHTING_MODES } from "./lighting-data";
import type { SceneSettings } from "./scene-settings";
import { controlText } from "./settings-components";

export function installLighting(settings: SceneSettings): void {
  const section = document.createElement("section"); section.className = "room-lighting settings-group";
  const heading = document.createElement("h3"); heading.textContent = LIGHTING_COPY.title;
  const choices = document.createElement("div"); choices.className = "lighting-choices";
  choices.setAttribute("role", "group"); choices.setAttribute("aria-label", LIGHTING_COPY.title);
  for (const mode of LIGHTING_MODES) {
    const button = document.createElement("button"); button.className = "world-button";
    controlText(button, mode === "lamplit" ? "lamp" : mode === "moonlit" ? "moon" : mode, LIGHTING_COPY.modes[mode]);
    button.dataset.lighting = mode;
    if (mode === "cycle") button.title = LIGHTING_COPY.help;
    button.addEventListener("click", () => settings.setLighting(mode));
    const sync = () => button.setAttribute("aria-pressed", String(settings.lighting === mode));
    settings.subscribe(sync); sync(); choices.append(button);
  }
  choices.setAttribute("aria-description", LIGHTING_COPY.help);
  section.append(heading, choices);
  controlPanel("effects").prepend(section);
}
