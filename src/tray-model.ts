export interface TrayBox { left: number; top: number; right: number; bottom: number }
export interface TrayRows { player: boolean; tiles: "none" | "settings" | "all" }

/** Whether the corner tray is out. It tucks behind Settings unless something gives it a reason to show. */
export class TrayModel {
  alwaysOpen = false;
  hovering = false;
  focused = false;
  /** Settings or the disc's song list is open, so the tray stays out under it. */
  held = false;
  /** The Music tile's choice: whether the board has a player row. Saved by SceneSettings (showPlayer). */
  musicShown: boolean;
  private pinned = false;
  private peekUntil = -Infinity;
  private readonly peekMs: number;
  constructor(peekMs: number, musicShown = true) { this.peekMs = peekMs; this.musicShown = musicShown; }

  /** What the board shows. Tucked, it keeps one row: the player, or with Music off just the Settings tile. */
  rows(now: number): TrayRows {
    if (this.isOpen(now)) return { player: this.musicShown, tiles: "all" };
    return this.musicShown ? { player: true, tiles: "none" } : { player: false, tiles: "settings" };
  }

  peek(now: number): void { this.peekUntil = now + this.peekMs; }
  isOpen(now: number): boolean {
    return this.alwaysOpen || now < this.peekUntil || this.hovering || this.focused || this.held || this.pinned;
  }
  msUntilPeekEnds(now: number): number | null { return now < this.peekUntil ? this.peekUntil - now : null; }

  /** A tucked tray press reveals tiles; visible player controls still act immediately. Touch keeps the tray open. */
  press(now: number, touch: boolean, playerControl = false): boolean {
    const wasOpen = this.isOpen(now);
    if (!wasOpen || touch) this.pinned = true;
    return !wasOpen && !playerControl;
  }
  pressOutside(): void { this.pinned = false; }
  /** The Music tile: hide or show the player pill. Returns the new choice. */
  toggleMusic(): boolean { this.musicShown = !this.musicShown; return this.musicShown; }
}

export function nearTray(x: number, y: number, box: TrayBox, reach: number): boolean {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy) <= reach;
}
