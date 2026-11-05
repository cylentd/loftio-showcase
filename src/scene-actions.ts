import { SCENE_ACTIONS } from "./copy";

export function mountSceneActions(): void {
  const group = document.createElement("div"); group.className = "scene-actions";
  group.setAttribute("role", "group"); group.setAttribute("aria-label", SCENE_ACTIONS.label);
  for (const selector of [".room-audio", ".postcard-action", ".scene-settings"]) {
    group.append(document.querySelector<HTMLElement>(selector)!);
  }
  document.body.append(group);
}
