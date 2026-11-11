import { REVEAL_FLIGHT } from './reveal-flight-constants.ts';

type Bounds = { x: number; y: number; width: number; height: number };

export function frameBox(view: Bounds, cover: boolean): Bounds {
  const { frame, box } = REVEAL_FLIGHT;
  const scale = (cover ? Math.max : Math.min)(view.width / frame.width, view.height / frame.height);
  return {
    x: view.x + (view.width - frame.width * scale) / 2 + box.x * scale,
    y: view.y + (view.height - frame.height * scale) / 2 + box.y * scale,
    width: box.width * scale, height: box.height * scale,
  };
}
