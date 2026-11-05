import { Container, Graphics } from "pixi.js";
import { CUE } from "./tune";

type Colours = { paper: string; edge: string; seal: string };

/** Puff's floating letter: an envelope with a wax seal. */
export function makeLetter(c: Colours): Container {
  const w = CUE.size;
  const h = w * 0.68;
  const g = new Graphics()
    .roundRect(-w / 2, -h / 2, w, h, 6)
    .fill({ color: c.paper })
    .stroke({ color: c.edge, width: 2.5 })
    .moveTo(-w / 2 + 3, -h / 2 + 3)
    .lineTo(0, h * 0.08)
    .lineTo(w / 2 - 3, -h / 2 + 3)
    .stroke({ color: c.edge, width: 2.5, join: "round", cap: "round" })
    .circle(0, h * 0.08, w * 0.11)
    .fill({ color: c.seal });
  const shadow = new Graphics().roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 6).fill({ color: c.edge, alpha: 0.35 });
  const root = new Container();
  root.addChild(shadow, g);
  return root;
}
