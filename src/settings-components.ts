import { icon } from "./icons";
import type { ICON_PATHS } from "./icon-data";
import { controlPanel } from "./controls";
type IconName = keyof typeof ICON_PATHS;

export function controlText(element: HTMLElement, name: IconName, text: string): void {
  const label = document.createElement("span");
  label.textContent = text;
  element.replaceChildren(icon(name), label);
}

export function settingsGroup(id: string, title: string, name: IconName): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const group = document.createElement("section"); group.id = id; group.className = "settings-group";
  const heading = document.createElement("h3"); heading.id = id + "-title";
  controlText(heading, name, title); group.setAttribute("aria-labelledby", heading.id);
  group.append(heading); controlPanel("room").append(group);
  return group;
}

export function switchRow(label: HTMLLabelElement, input: HTMLInputElement, title: string, help: string, name: IconName): void {
  const content = document.createElement("span"); content.className = "setting-copy";
  const text = document.createElement("span"); text.textContent = title;
  content.append(text);
  if (help) {
    const hint = document.createElement("small"); hint.textContent = help;
    hint.id = input.id + "-help"; input.setAttribute("aria-describedby", hint.id); content.append(hint);
  }
  input.setAttribute("aria-label", title);
  label.replaceChildren(icon(name), content, input);
}
