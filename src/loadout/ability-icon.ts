// One code-drawn ability icon: an inline SVG that takes its colour from the surrounding text.
import { ABILITY_ICON_PATHS } from './ability-icon-data.ts';

const SVG = 'http://www.w3.org/2000/svg';

export function abilityIcon(name: keyof typeof ABILITY_ICON_PATHS): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [key, value] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'],
    ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['class', 'ability-icon']]) svg.setAttribute(key!, value!);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', ABILITY_ICON_PATHS[name]); svg.append(path);
  return svg;
}
