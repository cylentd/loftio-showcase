import { SCENE_SETTINGS, SETTINGS_NAV } from "./copy";
import { controlText, settingsGroup, switchRow } from "./settings-components";
import { EFFECT_RANGE, type EffectKey } from "./scene-settings-data";
import type { SceneSettings } from "./scene-settings";
import { controlPanel } from "./controls";
import { aboutCorner } from "./about";

function slider(key: EffectKey, settings: SceneSettings) {
  const row = document.createElement("div");
  row.className = "effect-control";
  const heading = document.createElement("div");
  heading.className = "effect-heading";
  const label = document.createElement("label");
  controlText(label, key === "leaves" ? "leaf" : key === "lights" ? "lamp" : "effects", SCENE_SETTINGS.effects[key]);
  const output = document.createElement("output");
  output.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.id = `effect-${key}`;
  label.htmlFor = input.id;
  input.type = "range";
  input.title = SCENE_SETTINGS.help;
  input.min = String(EFFECT_RANGE.min);
  input.max = String(EFFECT_RANGE.max);
  input.step = String(EFFECT_RANGE.step);
  const sync = () => {
    input.value = String(settings.get(key));
    output.textContent = `${input.value}%`;
    input.setAttribute("aria-valuetext", output.textContent);
  };
  input.addEventListener("input", () => settings.set(key, input.valueAsNumber));
  settings.subscribe(sync);
  if (key === "lights") settings.subscribeGlow(sync);
  sync();
  heading.append(label, output);
  row.append(heading, input);
  return row;
}

export function installSceneSettings(settings: SceneSettings, openLetter: (trigger: HTMLElement) => void): void {
  const effects = document.createElement("section");
  effects.className = "scene-effects";
  const panel = document.createElement("div");
  panel.className = "effect-panel";
  panel.setAttribute("aria-label", SCENE_SETTINGS.atmosphere);
  for (const key of Object.keys(SCENE_SETTINGS.effects) as EffectKey[]) panel.append(slider(key, settings));
  const reset = document.createElement("button"); reset.className = "world-button";
  controlText(reset, "reset", SCENE_SETTINGS.reset);
  reset.addEventListener("click", () => settings.reset());
  panel.append(reset);
  effects.append(panel);
  const label = document.createElement("label");
  label.className = "cue-control";
  const cue = document.createElement("input");
  cue.type = "checkbox";
  cue.id = "settings-letter";
  cue.checked = settings.showCue;
  cue.addEventListener("change", () => settings.setCue(cue.checked));
  settings.subscribe(() => { cue.checked = settings.showCue; });
  switchRow(label, cue, SCENE_SETTINGS.showCue, "", "letter");
  const read = document.createElement("button"); read.className = "world-button";
  controlText(read, "letter", SCENE_SETTINGS.readCue);
  read.addEventListener("click", () => {
    const menu = read.closest<HTMLDetailsElement>(".scene-settings")!;
    read.closest<HTMLDialogElement>(".scene-controls")!.close();
    menu.open = false;
    openLetter(menu.querySelector<HTMLElement>(":scope > summary")!);
  });
  controlPanel("effects").append(effects);
  const letter = settingsGroup("letter-settings", SETTINGS_NAV.letter, "letter");
  letter.querySelector("h3")!.classList.add("visually-hidden");
  letter.classList.add("room-letter"); letter.append(label, read);
  letter.append(aboutCorner());
}
