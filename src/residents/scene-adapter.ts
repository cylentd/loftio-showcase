import { Texture } from 'pixi.js';
import { Resident } from '../resident';
import { css, seeded, type Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import type { installResidentControls } from '../resident-controls';
import { activeRoom } from '../room-layout';
import { floorPosition, placementPosition } from '../resident-movement';
import { inspectImage } from '../builder/image-inspection';
import { imageSource } from '../builder/image-source';
import type { SavedCharacter } from '../builder/records';
import type { ResidentEntry, ResidentRegistry } from './registry';
import { RESIDENT_COPY } from './copy';
import { motionFor } from './motion';
import { ARRIVAL, arrivalPlace } from './placement';

const SIZE_BIAS = 0.85;
const ARRIVAL_GLOW = 'arrived';
export const arrivalSpot = () => floorPosition(ARRIVAL.entry[activeRoom]);
/** The open floor spot a newcomer will take, clear of everyone standing or walking now. */
export const openSpot = (scene: Scene) => arrivalPlace(arrivalSpot(), scene.residents.flatMap(resident => resident.seatClaims), point => floorPosition(point));

async function cutout(saved: SavedCharacter) {
  const report = await inspectImage(saved.image);
  if (report.verdict !== 'transparent' || !report.bounds) throw Error('Resident needs a transparent subject');
  const image = new Image(); image.src = imageSource(saved.image); await image.decode();
  const bounds = report.bounds;
  const canvas = document.createElement('canvas');
  canvas.width = bounds.right - bounds.left + 1; canvas.height = bounds.bottom - bounds.top + 1;
  canvas.getContext('2d')!.drawImage(image, bounds.left, bounds.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return Texture.from(canvas);
}

export function sceneResidents(scene: Scene, runtime: Runtime, overlay: Overlay,
  controls: ReturnType<typeof installResidentControls>, registry: ResidentRegistry, changed: () => void) {
  const textures = new Map<string, Texture>();
  const pending = new Set<string>();
  const destination = () => openSpot(scene);
  // A warm pool of light at the newcomer's feet says who just arrived, then fades (styles.css).
  const glow = (id: string) => {
    const button = overlay.residentButton(id); button.dataset[ARRIVAL_GLOW] = 'true';
    button.addEventListener('animationend', () => { delete button.dataset[ARRIVAL_GLOW]; }, { once: true });
  };
  controls.onDrop = resident => {
    if (!resident.cast.id.startsWith('resident:')) return;
    try { registry.position(resident.cast.id, activeRoom, placementPosition(resident.pos)); }
    catch { overlay.announce(RESIDENT_COPY.actionFailure); }
  };
  return {
    async add(entry: ResidentEntry, saved: SavedCharacter, welcome = false, skip = false) {
      if (scene.residents.some(resident => resident.cast.id === entry.id) || pending.has(entry.id)) return;
      pending.add(entry.id);
      try {
        const texture = textures.get(entry.id) ?? await cutout(saved); textures.set(entry.id, texture);
        if (welcome && !registry.canWelcome(entry.id)) throw Error(RESIDENT_COPY.capacity);
        const target = entry.positions[activeRoom] ? placementPosition(entry.positions[activeRoom]!) : destination();
        registry.position(entry.id, activeRoom, target);
        const home = () => registry.list().find(item => item.id === entry.id)?.positions[activeRoom] ?? arrivalSpot();
        const cast = { id: entry.id, art: imageSource(saved.image), get home() { return home(); },
          get interest() { return home(); }, get spot() { return home(); }, sizeBias: SIZE_BIAS,
          motion: motionFor(saved.resolvedSelections.creature.id) };
        const resident = new Resident(cast, texture, scene.dot,
          { shadow: css('--grove-shadow'), tintFront: css('--grove-tint-front'), tintBack: css('--grove-tint-back') }, seeded(entry.id.length));
        overlay.addResident(entry.id, saved.resolvedSelections.creature.label, () => { if (!runtime.look.frozen) resident.play('press'); }, RESIDENT_COPY.greeting);
        scene.residents.push(resident); scene.cast.addChild(resident.root); controls.bind(resident);
        // Membership is recorded only once the sprite exists, so a failed build can be retried.
        if (welcome) {
          try { registry.welcome(entry.id); }
          catch (error) { scene.residents.pop(); resident.root.destroy({ children: true }); overlay.removeResident(entry.id); throw error; }
          glow(entry.id);
        }
        if (welcome && !skip && !runtime.look.frozen) {
          Object.assign(resident.pos, arrivalSpot());
          if (!resident.walkTo(target, 'home', !scene.residents.some(item => item.ladderReserved), scene.residents.filter(item => item !== resident).flatMap(item => item.seatClaims))) Object.assign(resident.pos, target);
          resident.play('look');
        }
        resident.update(0, runtime.clock, runtime.look.frozen); runtime.update(0); changed();
      } finally { pending.delete(entry.id); }
    },
    remove(id: string) {
      const index = scene.residents.findIndex(resident => resident.cast.id === id);
      if (index < 0 || !id.startsWith('resident:')) return;
      registry.remove(id);
      const [resident] = scene.residents.splice(index, 1); resident!.root.destroy({ children: true });
      overlay.removeResident(id); changed();
    },
  };
}
