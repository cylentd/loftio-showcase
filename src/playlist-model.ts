/** Which song is current. The settings picker and the now-playing pill both read it, so they never disagree. */
export class Playlist<T extends { readonly id: string }> {
  private index = 0;
  private readonly tracks: readonly T[];
  private readonly listeners = new Set<() => void>();
  constructor(tracks: readonly T[]) { this.tracks = tracks; }

  get current(): T { return this.tracks[this.index]!; }
  subscribe(listener: () => void): void { this.listeners.add(listener); }
  next(): void { this.move((this.index + 1) % this.tracks.length); }
  select(id: string): void {
    const index = this.tracks.findIndex(track => track.id === id);
    if (index >= 0) this.move(index);
  }
  private move(index: number): void {
    if (index === this.index) return;
    this.index = index;
    for (const listener of this.listeners) listener();
  }
}
