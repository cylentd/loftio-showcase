import type { Guest } from './invite-contract';
export type GuestStore = { list(): Promise<Guest[]>; add(guest: Guest): Promise<boolean>; remove(id: string): Promise<void> };
export type PreparedGuest = { attach(): void; dispose(): void };
export type GuestScene = { prepare(guest: Guest): Promise<PreparedGuest>; remove(id: string): void };
export function guestController(store: GuestStore, scene: GuestScene) {
  return {
    async welcome(guest: Guest) {
      const prepared = await scene.prepare(guest);
      let added = false;
      try {
        added = await store.add(guest);
        prepared.attach();
        return added;
      } catch (error) {
        prepared.dispose();
        if (added) await store.remove(guest.id);
        throw error;
      }
    },
    async remove(id: string) { await store.remove(id); scene.remove(id); },
    async restore() {
      let complete = true;
      for (const guest of await store.list()) {
        let prepared: PreparedGuest | undefined;
        try { prepared = await scene.prepare(guest); prepared.attach(); }
        catch { prepared?.dispose(); complete = false; }
      }
      return complete;
    },
  };
}
