/** The disc's song list: open or closed, and which row the keyboard cursor is on. It never owns the current song; the Playlist does. */
export type PickerAction = { kind: "none" } | { kind: "open" } | { kind: "move" } | { kind: "pick"; index: number } | { kind: "close" };

export interface Box { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

export class TrackPicker {
  open = false;
  active = 0;
  private readonly count: number;
  constructor(count: number) { this.count = count; }

  /** Opens with the cursor on the playing song, so Enter straight away keeps it. */
  show(current: number): void { this.open = true; this.active = current; }
  hide(): void { this.open = false; }
  toggle(current: number): void { if (this.open) this.hide(); else this.show(current); }

  /** One key, on the closed disc or inside the open list. Enter and Space on the closed disc are the button's own click. */
  key(key: string): PickerAction {
    if (!this.open) return key === "ArrowDown" || key === "ArrowUp" ? { kind: "open" } : { kind: "none" };
    switch (key) {
      case "ArrowDown": return this.moveTo(this.active + 1);
      case "ArrowUp": return this.moveTo(this.active - 1);
      case "Home": return this.moveTo(0);
      case "End": return this.moveTo(this.count - 1);
      // A pick leaves the list open, so a listener can try song after song.
      case "Enter": case " ": return { kind: "pick", index: this.active };
      case "Escape": case "Tab": this.hide(); return { kind: "close" };
      default: return { kind: "none" };
    }
  }

  private moveTo(index: number): PickerAction {
    this.active = (index + this.count) % this.count;
    return { kind: "move" };
  }
}

/** Where the list goes: above the disc with their left edges lined up, pushed inside the screen margin.
 *  Below the disc only when there is no room above; pinned to the top margin when neither side fits. */
export function placeTrackList(disc: Box, list: Size, view: Size, gap: number, margin: number): { left: number; top: number } {
  const left = Math.max(margin, Math.min(disc.left, view.width - margin - list.width));
  const above = disc.top - gap - list.height;
  const below = disc.bottom + gap;
  const top = above >= margin ? above : below + list.height <= view.height - margin ? below : margin;
  return { left, top };
}
