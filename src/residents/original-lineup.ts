type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export type OriginalEntry = { id: string; inRoom: boolean };

export function originalLineup(storage: Storage, ids: readonly string[], key: string) {
  const raw = storage.getItem(key);
  const stored = raw === null ? { version: 1, away: [] } : JSON.parse(raw);
  if (stored?.version !== 1 || !Array.isArray(stored.away)
    || stored.away.some((id: unknown) => typeof id !== 'string' || !ids.includes(id))
    || new Set(stored.away).size !== stored.away.length) throw Error('Invalid original lineup');
  let away = new Set<string>(stored.away);
  return {
    list(): OriginalEntry[] { return ids.map(id => ({ id, inRoom: !away.has(id) })); },
    setInRoom(id: string, inRoom: boolean): void {
      if (!ids.includes(id)) throw Error('Unknown original resident');
      if (inRoom === !away.has(id)) return;
      const next = new Set(away);
      if (inRoom) next.delete(id); else next.add(id);
      storage.setItem(key, JSON.stringify({ version: 1, away: [...next] }));
      away = next;
    },
  };
}
export type OriginalLineup = ReturnType<typeof originalLineup>;
