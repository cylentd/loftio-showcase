import { LOOK, SETTINGS_NAV } from "./copy";
import { icon } from "./icons";
export type ControlSection = keyof typeof SETTINGS_NAV.tabs;

export function controlPanel(section: ControlSection): HTMLElement {
  return document.getElementById(`settings-${section}`)!;
}

function navigation(): { heading: HTMLElement; tabs: HTMLElement; panels: HTMLElement[] } {
  const heading = document.createElement("h2");
  heading.className = "settings-heading"; heading.textContent = SETTINGS_NAV.title;
  const tabs = document.createElement("div"); tabs.className = "settings-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", SETTINGS_NAV.title);
  const panels: HTMLElement[] = [];
  const buttons: HTMLButtonElement[] = [];
  const select = (index: number, focus = false) => {
    buttons.forEach((button, at) => { button.setAttribute("aria-selected", String(at === index)); button.tabIndex = at === index ? 0 : -1; panels[at]!.hidden = at !== index; });
    if (focus) buttons[index]!.focus();
  };
  for (const [key, label] of Object.entries(SETTINGS_NAV.tabs)) {
    const button = document.createElement("button"); button.id = `tab-${key}`; button.append(icon(key as ControlSection), document.createTextNode(label));
    button.setAttribute("role", "tab"); button.setAttribute("aria-controls", `settings-${key}`);
    const panel = document.createElement("section"); panel.id = `settings-${key}`; panel.className = "scene-tab-panel";
    panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", button.id);
    const index = buttons.length; buttons.push(button); panels.push(panel); tabs.append(button);
    button.addEventListener("click", () => select(index));
    button.addEventListener("keydown", (event) => {
      const offset = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: buttons.length - 1 - index }[event.key];
      if (offset === undefined) return;
      event.preventDefault(); select((index + offset + buttons.length) % buttons.length, true);
    });
  }
  select(0);
  return { heading, tabs, panels };
}

export function mountControls(toolbar: HTMLElement): void {
  const existing = [...toolbar.childNodes];
  const { heading, tabs, panels } = navigation();
  const header = document.createElement("header"); header.className = "settings-header";
  const close = document.createElement("button"); close.type = "button";
  close.className = "settings-close"; close.setAttribute("aria-label", SETTINGS_NAV.close); close.title = SETTINGS_NAV.close;
  close.append(icon("close")); header.append(heading, close);
  const motion = document.createElement("div"); motion.className = "room-motion";
  motion.append(...existing); panels[0]!.append(motion);
  toolbar.append(header, tabs, ...panels);
  const menu = document.createElement("details");
  menu.className = "scene-settings";
  const toggle = document.createElement("summary"); toggle.className = "room-action";
  toggle.setAttribute("aria-label", LOOK.controls);
  toggle.title = LOOK.controls;
  toggle.append(icon("settings"));
  menu.append(toggle, toolbar);
  close.addEventListener("click", () => { menu.open = false; toggle.focus(); });
  document.body.append(menu);
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    toggle.focus();
  });
}
