import { CUE_LABEL, LINES, NAMES, PANEL, ARRIVALS, LOFT_ARRIVAL } from "./copy";
import { BUBBLE_MS } from "./tune";
import { bubbleMetrics } from "./bubble-model";

export type Rect = { x: number; y: number; w: number; h: number };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** The DOM over the canvas: one native button per resident and the letter, the speech bubble, the decision panel. */
export class Overlay {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly cue: HTMLButtonElement;
  private readonly bubble = el("p", "bubble");
  private readonly live = el("p", "visually-hidden");
  private readonly panel = el("dialog", "panel");
  private bubbleFor: string | null = null;
  private bubbleTimer = 0;
  private returnFocus: HTMLElement | null = null;
  private readonly labels = new Map<string, string>();

  constructor(
    private readonly layer: HTMLElement,
    ids: string[],
    onPress: (id: string) => void,
    private readonly onLater: () => void,
  ) {
    for (const id of ids) {
      const b = el("button", "hit");
      b.type = "button";
      b.setAttribute("aria-label", NAMES[id] ?? id);
      b.addEventListener("click", () => {
        onPress(id);
        this.say(id);
      });
      layer.append(b);
      this.buttons.set(id, b);
    }
    this.cue = el("button", "hit hit-cue");
    this.cue.type = "button";
    this.cue.setAttribute("aria-label", CUE_LABEL);
    this.cue.addEventListener("click", () => this.open());
    this.live.setAttribute("aria-live", "polite");
    this.bubble.hidden = true;
    layer.append(this.cue, this.bubble);
    document.body.append(this.live, this.panel);
    this.buildPanel();
  }

  place(id: string, r: Rect): void {
    const b = id === "cue" ? this.cue : this.buttons.get(id);
    if (b) b.style.transform = `translate(${r.x}px, ${r.y}px)`;
    if (b) b.style.width = `${r.w}px`;
    if (b) b.style.height = `${r.h}px`;
  }

  /** Anchor point (head top, centre) of whoever is speaking, so the bubble rides along. */
  placeBubble(anchor: (id: string) => { x: number; y: number; height: number } | null): void {
    if (!this.bubbleFor) return;
    const a = anchor(this.bubbleFor);
    if (!a) return;
    const metrics = bubbleMetrics(a.height);
    this.bubble.style.setProperty("--bubble-width", metrics.width + "px");
    this.bubble.style.setProperty("--bubble-scale", String(metrics.scale));
    const style = getComputedStyle(this.bubble);
    const gutter = parseFloat(style.getPropertyValue("--bubble-gutter"));
    const gap = parseFloat(style.getPropertyValue("--bubble-gap")) * metrics.scale;
    const origin = this.bubble.parentElement!.getBoundingClientRect();
    const width = this.bubble.offsetWidth;
    const left = Math.max(gutter - origin.left, Math.min(innerWidth - gutter - origin.left - width, a.x - width / 2));
    const top = Math.max(gutter - origin.top, a.y - this.bubble.offsetHeight - gap);
    const tail = Math.max(gutter, Math.min(width - gutter, a.x - left));
    this.bubble.style.transform = `translate(${left}px, ${top}px)`;
    this.bubble.style.setProperty("--bubble-tail-x", `${tail}px`);
  }

  residentButton(id: string): HTMLButtonElement { return this.buttons.get(id)!; }

  addResident(id: string, name: string, onPress: () => void, greeting: string): void {
    if (this.buttons.has(id)) return;
    const button = el('button', 'hit'); button.type = 'button'; button.setAttribute('aria-label', name);
    button.addEventListener('click', () => { onPress(); this.say(id, greeting); });
    this.labels.set(id, name); this.buttons.set(id, button); this.layer.append(button);
  }

  removeResident(id: string): void {
    this.buttons.get(id)?.remove(); this.buttons.delete(id); this.labels.delete(id);
    if (this.bubbleFor === id) { this.bubble.hidden = true; this.bubbleFor = null; }
  }

  announce(message: string): void { this.live.textContent = message; }

  arrive(id: string, upstairs = false): void { this.say(id, upstairs ? LOFT_ARRIVAL : ARRIVALS[id]); }

  private say(id: string, line = LINES[id]): void {
    if (!line) return;
    this.bubbleFor = id;
    this.bubble.textContent = line;
    this.bubble.dataset.name = this.labels.get(id) ?? NAMES[id] ?? id;
    this.bubble.hidden = false;
    this.live.textContent = `${this.labels.get(id) ?? NAMES[id] ?? id}: ${line}`;
    window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => {
      this.bubble.hidden = true;
      this.bubbleFor = null;
    }, BUBBLE_MS);
  }

  setCueVisible(visible: boolean): void {
    this.cue.hidden = !visible;
  }

  open(trigger: HTMLElement = this.cue): void {
    this.returnFocus = trigger;
    this.panel.showModal();
  }

  private buildPanel(): void {
    const title = el("h2", "panel-title", PANEL.title);
    title.id = "panel-title";
    this.panel.setAttribute("aria-labelledby", title.id);
    const cards = el("div", "panel-cards");
    for (const c of PANEL.cards) {
      const card = el("section", "choice");
      const gain = el("p", "choice-gain", c.benefit);
      const cost = el("p", "choice-cost", c.tradeoff);
      card.append(el("h3", "choice-name", c.name), gain, cost);
      cards.append(card);
    }
    const actions = el("div", "panel-actions");
    const back = el("button", "btn", PANEL.back);
    const later = el("button", "btn btn-primary", PANEL.later);
    back.type = later.type = "button";
    back.addEventListener("click", () => this.panel.close());
    later.addEventListener("click", () => {
      this.panel.close();
      this.onLater();
    });
    actions.append(back, later);
    const body = el("div", "panel-body");
    body.append(title, el("p", "panel-summary", PANEL.summary), cards, actions);
    this.panel.append(body);
    this.panel.addEventListener("click", (e) => {
      if (e.target === this.panel) this.panel.close(); // a press on the dimmed scene closes it
    });
    this.panel.addEventListener("close", () => this.returnFocus?.focus());
  }
}
