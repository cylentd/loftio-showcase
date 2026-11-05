import { ICON_PATHS } from "./icon-data";
export function icon(name: keyof typeof ICON_PATHS): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true"); svg.classList.add("control-icon");
  const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", ICON_PATHS[name]); svg.append(path);
  return svg;
}
