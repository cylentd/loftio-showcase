import { worldButton } from '../world-ui';
import { DragPlacement, floorPosition, placementPosition, surfaceAt, worldPoint } from '../resident-movement';
import { activeRoom } from '../room-layout';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { ResidentEntry, Position } from './registry';
import { blindBox } from './blind-box';
import { deliveryArt } from './delivery-art';
import type { Resident } from '../resident';
import { PLACEMENT } from '../resident-movement-data';
import { WORLD } from '../tune';
import { grabStyle } from '../grab-style';
import { vibrate } from '../tactile';
import { RESIDENT_COPY as COPY } from './copy';
import { arrivalSpot } from './scene-adapter';
import { arrivalPlace } from './placement';
import { DELIVERY as TUNE } from './delivery-constants';
import { deliveryMotion } from './delivery-motion';
import { deliverySound } from './delivery-sound';
import type { RevealAudioPreference } from './unboxing-sound';
import './delivery.css';

type Parcel = {
  entry: ResidentEntry; button: HTMLButtonElement; art: HTMLElement; dust: HTMLElement;
  motion: ReturnType<typeof deliveryMotion>; drag: DragPlacement; room: typeof activeRoom;
  pointer: number | null; moved: boolean; suppress: boolean; impacts: number; settled: boolean;
  resident?: Resident; disposed?: boolean;
  notice: HTMLElement; noticeLeft: number;
};

export function roomDeliveries(scene: Scene, runtime: Runtime,
  reveal: (entry: ResidentEntry, trigger: HTMLButtonElement) => void, audio: RevealAudioPreference,
  save: (id: string, room: typeof activeRoom, point: Position) => ResidentEntry | undefined, failure: (error: unknown) => void) {
  const parcels = new Map<string, Parcel>();
  const thump = deliverySound(audio);
  const world = (point: Position) => {
    const look = runtime.look;
    return worldPoint(point, { scale: look.scale, left: -look.left + (scene.cast.x - look.x) * look.scale,
      top: look.offsetY + (scene.cast.y - look.y) * look.scale });
  };
  const constrain = (point: Position, button: HTMLElement, anchor?: Position) => {
    const position = anchor ? floorPosition(point, surfaceAt(anchor)) : point;
    const half = button.offsetWidth / 2 + TUNE.margin;
    const left = world({ x: half, y: 0 }).x, right = world({ x: innerWidth - half, y: 0 }).x;
    return { x: Math.max(left, Math.min(right, position.x)), y: Math.max(0, Math.min(WORLD.height, position.y)) };
  };
  const persist = (parcel: Parcel) => {
    parcel.settled = true;
    try {
      const saved = save(parcel.entry.id, activeRoom, parcel.motion.state().ground);
      if (saved) parcel.entry = saved;
    } catch (error) { failure(error); }
  };
  const destination = (button: HTMLElement) => arrivalPlace(arrivalSpot(), [
    ...scene.residents.flatMap(resident => resident.seatClaims),
    ...[...parcels.values()].map(parcel => parcel.motion.state().ground),
  ], point => constrain(floorPosition(point), button));
  const cancel = (parcel: Parcel) => {
    if (parcel.pointer === null) return;
    const pointer = parcel.pointer; parcel.pointer = null;
    parcel.resident?.touch(false);
    parcel.resident?.putDown(true, false, runtime.clock);
    parcel.drag.finish(pointer, true); parcel.motion.cancel(); parcel.suppress = parcel.moved;
    if (parcel.button.hasPointerCapture(pointer)) parcel.button.releasePointerCapture(pointer);
  };
  function make(entry: ResidentEntry) {
    const button = worldButton(COPY.reveal, () => {}); button.className = 'arrival-box';
    const help = document.createElement('span'); help.className = 'visually-hidden'; help.id = entry.id + '-box-help'; help.textContent = COPY.boxHelp;
    button.setAttribute('aria-describedby', help.id); button.setAttribute('aria-label', COPY.reveal);
    const tag = document.createElement('span'); tag.className = 'arrival-box-tag arrival-box-notice'; tag.textContent = COPY.creationArrived;
    tag.style.setProperty('--delivery-notice-fade', TUNE.noticeFadeMs + 'ms');
    const noticeLeft = Object.keys(entry.deliveryPositions ?? {}).length ? 0 : TUNE.noticeMs;
    tag.hidden = noticeLeft === 0; tag.setAttribute('aria-hidden', 'true');
    const hint = document.createElement('span'); hint.className = 'arrival-box-tag arrival-box-hint'; hint.textContent = COPY.reveal;
    hint.setAttribute('aria-hidden', 'true');
    const shadow = document.createElement('span'); shadow.className = 'delivery-shadow'; shadow.setAttribute('aria-hidden', 'true');
    const dust = document.createElement('span'); dust.className = 'delivery-dust'; dust.setAttribute('aria-hidden', 'true');
    const art = blindBox(); button.replaceChildren(shadow, dust, art, tag, hint, help);
    document.querySelector('#world')!.append(button);
    const initial = entry.deliveryPositions?.[activeRoom] ?? destination(button);
    const motion = deliveryMotion(initial, (point, anchor) => constrain(point, button, anchor), point => constrain(placementPosition(point), button));
    const parcel: Parcel = { entry, button, art, dust, motion, drag: new DragPlacement(), room: activeRoom,
      pointer: null, moved: false, suppress: false, impacts: 0, settled: false, notice: tag, noticeLeft };
    void deliveryArt(scene, entry.id, initial).then(resident => {
      if (parcel.disposed) { resident.root.destroy({ children: true }); return; }
      parcel.resident = resident; button.dataset.renderer = 'scene';
      scene.actors.push(resident.root); scene.cast.addChild(resident.root);
    }).catch(failure);
    motion.arrive(!runtime.look.frozen && !entry.deliveryPositions?.[activeRoom]);
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || parcel.pointer !== null) return;
      const client = { x: event.clientX, y: event.clientY };
      if (!parcel.drag.begin(entry.id, event.pointerId, client, world(client), motion.state().point)) return;
      parcel.pointer = event.pointerId; parcel.moved = false; parcel.suppress = false;
      parcel.noticeLeft = 0; parcel.notice.hidden = true;
      parcel.resident?.touch(true);
      if (event.pointerType === 'touch') vibrate('touch', runtime.look.frozen);
      button.setPointerCapture(event.pointerId); event.stopPropagation();
    });
    button.addEventListener('pointermove', event => {
      if (parcel.pointer !== event.pointerId) return;
      const client = { x: event.clientX, y: event.clientY };
      const position = parcel.drag.move(event.pointerId, client, world(client));
      if (!position) return;
      const resident = parcel.resident;
      if (!parcel.moved) {
        if (resident) { grabStyle(resident); resident.pickUp(motion.state().phase === 'falling', 'parcel'); }
        motion.hold(); parcel.moved = true;
      }
      const before = motion.state().ground;
      resident?.pull(position.x - before.x, position.y - before.y);
      motion.move(position, event.timeStamp); parcel.settled = false;
      if (resident) { Object.assign(resident.pos, motion.state().ground); resident.update(0, runtime.clock, runtime.look.frozen); }
      button.dataset.motion = 'held'; event.preventDefault(); event.stopPropagation();
    });
    button.addEventListener('pointerup', event => {
      if (parcel.pointer !== event.pointerId) return;
      const result = parcel.drag.finish(event.pointerId); parcel.pointer = null;
      parcel.resident?.touch(false);
      if (event.pointerType === 'touch' && result?.moved) vibrate('release', runtime.look.frozen);
      parcel.suppress = !!result?.moved;
      if (result?.moved) {
        const lift = parcel.resident?.lift ?? 0;
        parcel.resident?.putDown(true, false, runtime.clock);
        motion.release(event.timeStamp, !runtime.look.frozen, lift, runtime.look.scale);
      }
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    });
    button.addEventListener('pointercancel', () => cancel(parcel));
    button.addEventListener('lostpointercapture', () => cancel(parcel));
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (parcel.suppress && event.detail !== 0) { parcel.suppress = false; event.preventDefault(); return; }
      motion.place(motion.state().ground); persist(parcel);
      reveal(parcel.entry, button);
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') { cancel(parcel); return; }
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault(); event.stopPropagation();
        motion.place(placementPosition({ x: motion.state().ground.x, y: event.key === 'PageUp' ? PLACEMENT.loftKeyY : PLACEMENT.groundKeyY }));
        persist(parcel); return;
      }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      const point = motion.state().ground;
      motion.place(floorPosition({ x: point.x + direction[0]! * TUNE.keyStep, y: point.y + direction[1]! * TUNE.keyStep }, surfaceAt(point))); persist(parcel);
    });
    return parcel;
  }
  addEventListener('blur', () => parcels.forEach(cancel));
  addEventListener('resize', () => parcels.forEach(cancel));
  document.addEventListener('visibilitychange', () => { if (document.hidden) parcels.forEach(cancel); });
  return {
    sync(entries: ResidentEntry[]) {
      const waiting = entries.filter(entry => entry.arrival === 'waiting');
      for (const [id, parcel] of parcels) if (!waiting.some(entry => entry.id === id)) {
        cancel(parcel); parcel.disposed = true;
        if (parcel.resident) {
          const index = scene.actors.indexOf(parcel.resident.root);
          if (index !== -1) scene.actors.splice(index, 1);
          parcel.resident.root.destroy({ children: true });
        }
        parcel.button.remove(); parcels.delete(id);
      }
      for (const entry of waiting) {
        const parcel = parcels.get(entry.id);
        if (parcel) parcel.entry = entry;
        else parcels.set(entry.id, make(entry));
      }
    },
    update(elapsed: number) {
      const roomVisible = !document.hidden && !document.querySelector('dialog[open]');
      for (const parcel of parcels.values()) {
        if (parcel.room !== activeRoom) {
          cancel(parcel); parcel.room = activeRoom;
          parcel.motion.place(parcel.entry.deliveryPositions?.[activeRoom] ?? destination(parcel.button)); parcel.settled = false;
        }
        if (runtime.look.frozen && parcel.motion.state().phase === 'falling') parcel.motion.place(parcel.motion.state().ground);
        parcel.motion.step(elapsed / TUNE.seconds);
        const state = parcel.motion.state(); parcel.button.dataset.motion = state.phase;
        if (parcel.noticeLeft > 0 && roomVisible && state.phase === 'resting') {
          parcel.noticeLeft = Math.max(0, parcel.noticeLeft - elapsed);
          parcel.notice.classList.toggle('is-fading', parcel.noticeLeft <= TUNE.noticeFadeMs);
          parcel.notice.hidden = parcel.noticeLeft === 0;
        }
        parcel.art.style.rotate = state.tilt + 'deg';
        const resident = parcel.resident;
        if (resident) {
          resident.root.renderable = parcel.button.dataset.revealing !== 'true';
          if (resident.root.parent !== scene.cast) scene.cast.addChild(resident.root);
          resident.setLighting(scene.lighting.timeline.blend);
          resident.updateTouch(elapsed, runtime.look.frozen);
          const lift = Math.max(0, state.ground.y - state.point.y);
          if (state.phase === 'held') {
            Object.assign(resident.pos, state.ground); resident.update(elapsed, runtime.clock, runtime.look.frozen);
          } else resident.poseAt(state.ground.x, state.ground.y, lift, {
            air: Math.min(1, lift / resident.height), sx: 1, sy: 1, rotation: state.tilt * Math.PI / TUNE.tiltDegrees,
          });
          if (state.phase === 'held') resident.root.zIndex = PLACEMENT.heldDepth;
          parcel.button.style.width = Math.max(TUNE.touchSize, resident.height * resident.aspect * runtime.look.scale) + 'px';
          parcel.button.style.height = Math.max(TUNE.touchSize, resident.height * runtime.look.scale) + 'px';
          parcel.button.style.zIndex = String(Math.round(resident.root.zIndex));
        }
        if (state.impacts !== parcel.impacts) {
          parcel.impacts = state.impacts;
          if (!runtime.look.frozen) { parcel.dust.classList.remove('is-poof'); void parcel.dust.offsetWidth; parcel.dust.classList.add('is-poof'); }
          thump();
        }
        if (state.phase === 'resting' && !parcel.settled) persist(parcel);
        const { scale, x, y, offsetY, left: scrolled } = runtime.look;
        const left = (state.point.x + scene.cast.x - x) * scale - scrolled;
        const top = (state.point.y + scene.cast.y - y) * scale + offsetY - (state.phase === 'held' ? (resident?.lift ?? 0) * scale : 0);
        const labelWidth = Math.min(TUNE.labelWidth, innerWidth - TUNE.margin * 2);
        const labelCenter = Math.max(labelWidth / 2 + TUNE.margin, Math.min(innerWidth - labelWidth / 2 - TUNE.margin, left));
        parcel.button.style.setProperty('--delivery-label-width', labelWidth + 'px');
        parcel.button.style.setProperty('--delivery-label-shift', (labelCenter - left) + 'px');
        const displayedHeight = resident ? Math.max(TUNE.touchSize, resident.height * scale) : parcel.button.offsetHeight;
        parcel.button.dataset.labelSide = top - displayedHeight < TUNE.labelClearance ? 'below' : 'above';
        parcel.button.style.left = left + scrolled + 'px';
        parcel.button.style.top = top + 'px';
      }
    },
  };
}
