import { RESIDENT_COPY as COPY } from './copy';
import './blind-box.css';

function part(parent: HTMLElement, ...names: string[]) {
  const node = document.createElement('span'); node.className = names.map(name => 'blind-box-' + name).join(' ');
  parent.append(node); return node;
}

/** A sealed carton built from flat card panels in 3D space; blind-box.css places, paints and opens them. */
export function blindBox() {
  const box = document.createElement('div'); box.className = 'blind-box'; box.setAttribute('aria-hidden', 'true');
  const model = part(box, 'model');
  // Painted in this order where panels share a plane: inside first, printed card next, the seal last.
  for (const wall of ['back', 'left']) part(model, wall);
  part(model, 'tissue'); part(model, 'tissue', 'tissue-fold');
  for (const wall of ['front', 'right']) part(model, wall);
  part(model, 'flap', 'flap-left'); part(model, 'flap', 'flap-right');
  const lip = part(part(model, 'lid'), 'lip');
  part(lip, 'strip').textContent = COPY.boxPull;
  // The seal is two halves of one picture: the upper half rides the lid's lip, the lower half stays on the front.
  part(lip, 'seal', 'seal-upper'); part(model, 'seal', 'seal-lower');
  return box;
}
