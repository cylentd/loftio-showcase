import { deliveryPortrait } from './delivery-art';
import { frameBox } from './reveal-flight-geometry';
import { REVEAL_FLIGHT as TUNE } from './reveal-flight-constants';
import './reveal-flight.css';

export function revealFlight(dialog: HTMLDialogElement, origin: HTMLButtonElement, video: HTMLVideoElement) {
  const portrait = deliveryPortrait();
  if (!portrait || !origin.classList.contains('arrival-box')) return;
  const source = origin.getBoundingClientRect();
  if (!source.width || !source.height) return;
  const layer = document.createElement('div'); layer.className = 'reveal-flight'; layer.setAttribute('aria-hidden', 'true');
  const dim = document.createElement('div'); dim.className = 'reveal-flight-dim';
  const fill = new Image(); fill.src = video.poster; fill.className = 'reveal-flight-fill';
  const background = new Image(); background.src = video.poster; background.className = 'reveal-flight-background';
  const shadow = document.createElement('div'); shadow.className = 'reveal-flight-shadow';
  Object.assign(shadow.style, { left: source.x + 'px', top: source.bottom + 'px', width: source.width + 'px', height: source.height * TUNE.shadowHeight + 'px' });
  const carton = document.createElement('div'); carton.className = 'reveal-flight-carton';
  const room = new Image(); room.src = portrait; room.className = 'reveal-flight-room';
  const match = new Image(); match.src = import.meta.env.BASE_URL + 'brand/box-reveal-cutout.webp'; match.className = 'reveal-flight-match';
  carton.append(room, match); layer.append(dim, fill, background, shadow, carton); dialog.append(layer);
  let disposed = false;
  let complete!: () => void;
  const ready = new Promise<void>(resolve => { complete = resolve; });
  const animations: Animation[] = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true; animations.forEach(animation => animation.cancel());
    layer.remove(); delete origin.dataset.revealing; complete();
    removeEventListener('resize', dispose);
  };
  addEventListener('resize', dispose, { once: true });
  const start = async () => {
    await Promise.all([room.decode(), match.decode(), background.decode()]);
    if (disposed || !dialog.open) { dispose(); return; }
    const frame = video.getBoundingClientRect();
    const target = frameBox(frame, getComputedStyle(video).objectFit === 'cover');
    Object.assign(background.style, {
      maskImage: `linear-gradient(white, white), url("${match.src}")`, maskRepeat: 'no-repeat',
      maskSize: `100% 100%, ${target.width}px ${target.height}px`,
      maskPosition: `0 0, ${target.x - frame.x}px ${target.y - frame.y}px`, maskComposite: 'exclude', maskMode: 'alpha',
    });
    const pose = (bounds: { x: number; y: number; width: number; height: number }) => ({
      left: bounds.x + 'px', top: bounds.y + 'px', width: bounds.width + 'px', height: bounds.height + 'px',
    });
    origin.dataset.revealing = 'true'; layer.dataset.phase = 'flying';
    const timing = { duration: TUNE.duration, easing: TUNE.ease, fill: 'forwards' as const };
    const movement = carton.animate([pose(source), { ...pose(source), top: source.y - TUNE.lift + 'px', offset: 0.2 }, pose(target)], timing);
    const framing = { ...timing, easing: TUNE.backgroundEase };
    const blend = [{ opacity: 0 }, { opacity: 0, offset: TUNE.backgroundDelay }, { opacity: 1 }];
    animations.push(movement, background.animate(blend, framing), fill.animate(blend, framing), dim.animate([{ opacity: 0 }, { opacity: 1 }], timing),
      shadow.animate([{ opacity: TUNE.shadowOpacity }, { opacity: 0 }], timing),
      room.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], timing),
      match.animate([{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }], timing));
    await Promise.all(animations.map(animation => animation.finished));
    if (disposed) return;
    background.style.maskImage = 'none'; carton.style.visibility = 'hidden';
    layer.dataset.phase = 'landed'; dialog.dataset.framed = 'true'; complete();
  };
  void start().catch(dispose);
  return { ready, dispose, finish: dispose };
}
