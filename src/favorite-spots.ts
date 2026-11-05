import { CAST } from "./cast";
import { FAVORITES, SETTINGS_NAV } from "./copy";
import { settingsGroup, switchRow } from "./settings-components";
import type { FavoriteScenery } from "./favorite-scenery";
import type { Look } from "./look";
import type { Overlay } from "./overlay";
import type { SceneSettings } from "./scene-settings";

export class FavoriteSpots {
  private readonly entries;
  private pointerHeld: string | null = null;
  constructor(layer: HTMLElement, private look: Look, private settings: SceneSettings, overlay: Overlay, private scenery: FavoriteScenery) {
    this.entries = CAST.map(resident => {
      const character = overlay.residentButton(resident.id);
      const description = document.createElement("span"); description.className = "visually-hidden";
      description.id = "favorite-" + resident.id; description.textContent = FAVORITES.labels[resident.id]!;
      layer.append(description);
      character.setAttribute("aria-describedby", character.getAttribute("aria-describedby") + " " + description.id);
      character.addEventListener("pointerdown", event => {
        if (event.button !== 0 || !event.isPrimary) return;
        this.pointerHeld = resident.id; this.update();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) character.addEventListener(event, () => {
        if (this.pointerHeld === resident.id) this.dismiss();
      });
      character.addEventListener("keydown", event => { if (event.key === " ") this.update(); });
      return { character, id: resident.id };
    });
    document.addEventListener("pointerdown", event => { if (!(event.target as HTMLElement).closest(".resident-hit")) this.dismiss(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") this.dismiss(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.dismiss(); });
    addEventListener("blur", () => this.dismiss()); addEventListener("resize", () => this.dismiss());
    const label = document.createElement("label"); label.className = "cue-control";
    const toggle = document.createElement("input"); toggle.type = "checkbox";
    toggle.id = "settings-favorites";
    toggle.addEventListener("change", () => settings.setFavorites(toggle.checked));
    switchRow(label, toggle, FAVORITES.toggle, FAVORITES.help, "leaf");
    const group = settingsGroup("resident-settings", SETTINGS_NAV.residents, "residents");
    group.insertBefore(label, group.querySelector(".room-resident-actions"));
    const sync = () => { toggle.checked = settings.showFavorites; this.update(); };
    settings.subscribe(sync); sync();
  }

  private dismiss(): void { this.pointerHeld = null; this.update(); }

  update(): void {
    const active = document.hidden ? [] : this.entries.filter(({ id, character }) =>
      this.settings.showFavorites || this.pointerHeld === id || character.dataset.held === "true").map(entry => entry.id);
    this.scenery.update(active, performance.now(), this.look.frozen);
  }
}
