import { LINES, NAMES } from '../copy';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import type { installResidentControls } from '../resident-controls';
import type { OriginalLineup } from './original-lineup';
import { openSpot } from './scene-adapter';

export function originalResidents(scene: Scene, runtime: Runtime, overlay: Overlay,
  controls: ReturnType<typeof installResidentControls>, lineup: OriginalLineup) {
  const originals = new Map(scene.residents.map(resident => [resident.cast.id, resident]));
  const remove = (id: string) => {
    const resident = originals.get(id);
    const index = resident ? scene.residents.indexOf(resident) : -1;
    if (!resident || index < 0) return;
    controls.forget(resident);
    scene.residents.splice(index, 1);
    scene.cast.removeChild(resident.root);
    overlay.removeResident(id);
  };
  for (const entry of lineup.list()) if (!entry.inRoom) remove(entry.id);
  return {
    setInRoom(id: string, inRoom: boolean) {
      const resident = originals.get(id);
      if (!resident) return;
      lineup.setInRoom(id, inRoom);
      if (!inRoom) remove(id);
      else if (!scene.residents.includes(resident)) {
        const target = openSpot(scene);
        resident.resetHome(); Object.assign(resident.pos, target);
        resident.putDown(true, false, runtime.clock);
        overlay.addResident(id, NAMES[id] ?? id, () => { if (!runtime.look.frozen) resident.play('press'); }, LINES[id] ?? '');
        scene.residents.push(resident); scene.cast.addChild(resident.root); controls.bind(resident);
        resident.update(0, runtime.clock, runtime.look.frozen);
      }
      runtime.update(0);
    },
  };
}
