import { Texture } from 'pixi.js';
import { Resident } from '../resident';
import { css, seeded, type Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import { openSpot } from '../residents/scene-adapter';
import { canonicalGuest, sourceOf } from './image';
import type { Guest } from './invite-contract';
import { COPY } from './copy';
import { activeRoom } from '../room-layout';
import type { Point } from '../cast';

type Context = { scene: Scene; runtime: Runtime; overlay: Overlay };
const SIZE_BIAS = 0.95; // Same median scale as created residents.

export function guestScene({ scene, runtime, overlay }: Context, inspect: (guest: Guest, trigger: HTMLElement) => void) {
  const owned = new Map<string, { resident: Resident; texture: Texture }>();
  let disposed = false;
  const remove = (id: string) => {
    const item = owned.get(id); if (!item) return;
    const index = scene.residents.indexOf(item.resident); if (index >= 0) scene.residents.splice(index, 1);
    overlay.removeResident(id); item.resident.root.destroy({ children: true }); item.texture.destroy(true);
    owned.delete(id); runtime.update(0);
  };
  return {
    async prepare(guest: Guest) {
      if (owned.has(guest.id)) return { attach() {}, dispose() {} };
      const { id: _id, ...invitation } = guest;
      const checked = await canonicalGuest(invitation);
      if (checked.id !== guest.id) throw Error(COPY.invalid);
      const image = new Image(); image.src = sourceOf(checked); await image.decode();
      if (disposed) throw Error(COPY.failed);
      const texture = Texture.from(image);
      const homes: Partial<Record<typeof activeRoom, Point>> = {};
      const home = () => homes[activeRoom] ?? (homes[activeRoom] = openSpot(scene));
      const cast = { id: guest.id, art: image.src, get home() { return home(); }, get interest() { return home(); }, get spot() { return home(); }, sizeBias: SIZE_BIAS };
      const resident = new Resident(cast, texture, scene.dot,
        { shadow: css('--grove-shadow'), tintFront: css('--grove-tint-front'), tintBack: css('--grove-tint-back') }, seeded(guest.id.length));
      let attached = false;
      return {
        attach() {
          if (disposed) throw Error(COPY.failed);
          if (owned.has(guest.id)) { resident.root.destroy({ children: true }); texture.destroy(true); return; }
          overlay.addResident(guest.id, guest.name, () => inspect(guest, overlay.residentButton(guest.id)), COPY.guest);
          const hit = overlay.residentButton(guest.id); hit.classList.add('resident-hit'); hit.dataset.guestId = guest.id;
          scene.residents.push(resident); scene.cast.addChild(resident.root);
          owned.set(guest.id, { resident, texture }); attached = true;
          resident.update(0, runtime.clock, runtime.look.frozen); runtime.update(0);
        },
        dispose() { if (attached) remove(guest.id); else { resident.root.destroy({ children: true }); texture.destroy(true); } },
      };
    },
    remove,
    dispose() { disposed = true; for (const id of [...owned.keys()]) remove(id); },
  };
}
