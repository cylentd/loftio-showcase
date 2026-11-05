export const FAVORITE_INSPECTION_MS = 6000;

export class FavoriteHint {
  private selected: string | null = null;
  private until = 0;
  show(id: string, now: number, held = false): void {
    this.selected = id;
    this.until = held ? Infinity : now + FAVORITE_INSPECTION_MS;
  }
  active(now: number): string | null { return now < this.until ? this.selected : null; }
  clear(): void { this.selected = null; this.until = 0; }
}
