/** The song a visit opens on: `favored` when `roll` (in [0, 1)) is under `chance`, else one of the others in equal shares, in list order. */
export function openingTrack(ids: readonly string[], favored: string, chance: number, roll: number): string {
  if (roll < chance) return favored;
  const others = ids.filter(id => id !== favored);
  const share = (roll - chance) / (1 - chance);
  return others[Math.min(others.length - 1, Math.floor(share * others.length))]!;
}

/** Which song is current. The settings picker and the now-playing pill both read it, so they never disagree. */
export class Playlist<T extends { readonly id: string }> {
  private index = 0;
  private readonly tracks: readonly T[];
  private readonly listeners = new Set<() => void>();
  /** Starts on `startId` when it names a track, else on the first. */
  constructor(tracks: readonly T[], startId?: string) {
    this.tracks = tracks;
    this.index = Math.max(0, tracks.findIndex(track => track.id === startId));
  }

  get current(): T { return this.tracks[this.index]!; }
  /** Every song in playing order, for the disc's song list. */
  get all(): readonly T[] { return this.tracks; }
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
