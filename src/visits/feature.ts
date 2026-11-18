import type { ResidentHooks } from '../residents/view';
import type { PortraitAction } from '../residents/view-parts';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import { worldButton } from '../world-ui';
import { guestStore } from './guest-store';
import { guestController } from './guest-controller';
import { guestScene } from './guest-scene';
import { visitViewer } from './view';
import { COPY } from './copy';
import { linksEnabled, takeVisitCode } from './link-boot';
import { linkPorts } from './link-actions';

type Room = { residents?: ResidentHooks; scene: Scene; runtime: Runtime; overlay: Overlay };
/** `hosted: true` offers hosted links without the build flag; the showcase passes it, the game follows VITE_VISIT_LINKS. */
function makeVisits({ hosted = false } = {}) {
  let viewer: ReturnType<typeof visitViewer> | undefined;
  const portrait: PortraitAction = { label: COPY.inspect, open: (item, trigger) => { void viewer?.owned(item, trigger); } };
  const install = (room: Room) => {
    const hooks = room.residents; if (!hooks?.extension || hooks.preview) return;
    // Hosted links exist only in a build with VITE_VISIT_LINKS=online or an installer made with `hosted`. The link in the address bar is read once, here.
    const links = linksEnabled(import.meta.env.VITE_VISIT_LINKS, hosted) ? linkPorts() : undefined;
    const code = takeVisitCode(!!links, location, history);
    const store = guestStore();
    const scene = guestScene(room, (guest, trigger) => { void viewer?.guest(guest, trigger); });
    const controller = guestController(store, scene);
    const section = document.createElement('section'); section.className = 'visit-extension'; section.setAttribute('aria-label', COPY.guests);
    const heading = document.createElement('h3'); heading.textContent = COPY.guests;
    const list = document.createElement('div'); list.className = 'visit-list';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.loftio-visit'; input.hidden = true;
    const open = worldButton(COPY.open, () => { input.value = ''; input.click(); });
    input.addEventListener('change', () => { const file = input.files?.[0]; if (file) void viewer?.import(file, open); input.value = ''; });
    let disposed = false;
    const changed = async (removed = false) => {
      try {
        const guests = await store.list(); if (disposed) return; list.replaceChildren(); status.textContent = guests.length ? '' : COPY.empty;
        for (const guest of guests) {
          const button = worldButton(guest.name, () => { void viewer?.guest(guest, button); }); list.append(button);
        }
        if (removed) open.focus();
      } catch { status.textContent = COPY.load; }
    };
    viewer = visitViewer({ ...controller, changed }, links);
    section.append(heading, open, input, list, status); hooks.extension.prepend(section);
    void hooks.restored.then(async loaded => {
      if (disposed) return;
      if (loaded) {
        try { const complete = await controller.restore(); await changed(); if (!complete) status.textContent = COPY.partial; } catch { status.textContent = COPY.load; }
      }
      if (code && !disposed) void viewer?.link(code, open); // preview only; Welcome is the friend's tap
    });
    return { teardown() { disposed = true; viewer?.dispose(); viewer = undefined; scene.dispose(); section.remove(); } };
  };
  return Object.assign(install, { residents: { portrait } });
}
export const visits = makeVisits();
export const hostedVisits = makeVisits({ hosted: true });
