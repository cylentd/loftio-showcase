type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export type OriginalEntry = { id: string; inRoom: boolean };

export function originalLineup(storage: Storage, ids: readonly string[], key: string) {
  const read = () => {
    const raw = storage.getItem(key);
    const stored = raw === null ? { version: 1, away: [] } : JSON.parse(raw);
    if (stored?.version !== 1 || !Array.isArray(stored.away)
      || stored.away.some((id: unknown) => typeof id !== 'string' || !ids.includes(id))
      || new Set(stored.away).size !== stored.away.length) throw Error('Invalid original lineup');
    return new Set<string>(stored.away);
  };
  read();
  return {
    list(): OriginalEntry[] { const away = read(); return ids.map(id => ({ id, inRoom: !away.has(id) })); },
    setInRoom(id: string, inRoom: boolean): void {
      if (!ids.includes(id)) throw Error('Unknown original resident');
      const next = read();
      if (inRoom === !next.has(id)) return;
      if (inRoom) next.delete(id); else next.add(id);
      storage.setItem(key, JSON.stringify({ version: 1, away: [...next] }));
    },
  };
}
export type OriginalLineup = ReturnType<typeof originalLineup>;
