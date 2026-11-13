import "./favorite-label.css";
import { FAVORITE_ART } from "./favorite-scenery-data";
import { favoriteAnchor, favoriteLabelLayout, type Box, type Point } from "./favorite-label-model";
import { FAVORITES, NAMES } from "./copy";
import { icon } from "./icons";
import type { Look } from "./look";

/** A quiet "<name>'s favorite" tag hung over each lit favorite spot, so the light reads as belonging to someone. */
export class FavoriteLabels {
  private readonly labels = new Map<string, HTMLElement>();
  private readonly previous = new Map<string, Point>();
  private readonly layer: HTMLElement;
  private readonly look: Look;
  constructor(layer: HTMLElement, look: Look) {
    this.layer = layer;
    this.look = look;
  }

  update(ids: string[]): void {
    for (const [id, label] of this.labels) if (!ids.includes(id)) { label.remove(); this.labels.delete(id); this.previous.delete(id); }
    const shown = ids.filter(id => FAVORITE_ART[id]);
    if (!shown.length) return;
    const origin = this.layer.getBoundingClientRect();
    const style = getComputedStyle(this.layer);
    const gutter = parseFloat(style.getPropertyValue("--bubble-gutter")), gap = parseFloat(style.getPropertyValue("--favorite-label-gap"));
    const labels = shown.map(id => this.labels.get(id) ?? this.make(id));
    const requests = shown.map((id, index) => ({
      anchor: favoriteAnchor(FAVORITE_ART[id]!), previous: this.previous.get(id),
      size: { width: labels[index]!.offsetWidth, height: labels[index]!.offsetHeight } }));
    const placements = favoriteLabelLayout(requests, this.look,
      { origin, viewport: { width: innerWidth, height: innerHeight }, gutter, gap }, this.obstacles());
    placements.forEach(({ left, top, offset }, index) => {
      labels[index]!.style.transform = `translate(${left}px, ${top}px)`;
      this.previous.set(shown[index]!, offset);
    });
  }

  /** Every resident and the letter cue on screen: a label never sits on something a person might tap. */
  private obstacles(): Box[] {
    return [...this.layer.querySelectorAll<HTMLElement>(".hit")]
      .filter(hit => !hit.hidden).map(hit => hit.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
  }

  private make(id: string): HTMLElement {
    const label = document.createElement("span");
    label.className = "favorite-label"; label.setAttribute("aria-hidden", "true");
    label.append(icon("leaf"), FAVORITES.tag(NAMES[id] ?? id));
    this.layer.append(label);
    this.labels.set(id, label);
    return label;
  }
}
