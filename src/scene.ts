import { Assets, Container, Sprite, type Renderer, type Texture } from "pixi.js";
import desktopRoomUrl from "../ui/assets/room/room-desktop.jpg";
import portraitRoomUrl from "../ui/assets/room/room-phone.jpg";
import { Ambience, softDot } from "./ambience";
import { CAST } from "./cast";
import { depthProps, Foliage, foreground } from "./foliage";
import { makeLetter } from "./letter";
import { Resident } from "./resident";
import { ROUTINE } from "./tune";
import type { SceneSettings } from "./scene-settings";
import { FavoriteScenery } from "./favorite-scenery";
import { Lighting } from "./lighting";
import { LIGHTING } from "./lighting-data";
import { activeRoom } from "./room-layout";
import { PORTRAIT_COUCH_DEPTH } from "./portrait-scenery-data";

export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function makeScene(settings: SceneSettings, renderer: Renderer, previous?: { residents: Resident[]; dot: Texture; lighting: Lighting; puff: Resident; actors?: Container[] }) {
  const roomUrl = activeRoom === "portrait" ? portraitRoomUrl : desktopRoomUrl;
  const nightUrl = activeRoom === "portrait" ? roomUrl : LIGHTING.artUrl;
  const urls = [...new Set([roomUrl, nightUrl, ...CAST.map((c) => c.art)])];
  const tex = await Assets.load<Texture>(urls) as Record<string, Texture>;
  const dot = previous?.dot ?? softDot();
  const lighting = new Lighting(tex[roomUrl]!, tex[nightUrl]!, dot, renderer, previous?.lighting.timeline);
  const roomTexture = lighting.texture;
  const world = new Container();
  const cast = new Container();
  cast.sortableChildren = true;
  const ambience = new Ambience(dot, { rain: css("--grove-rain"), mote: css("--grove-mote"), glow: css("--grove-glow") }, seeded(ROUTINE.seed), settings);
  const foliage = new Foliage(roomTexture, settings);
  const palette = { shadow: css("--grove-shadow"), tintFront: css("--grove-tint-front"), tintBack: css("--grove-tint-back") };
  const residents = previous?.residents ?? CAST.map((c) => new Resident(c, tex[c.art]!, dot, palette, seeded(ROUTINE.seed + c.home.x)));
  for (const r of residents) cast.addChild(r.root);
  const actors = previous?.actors ?? [];
  for (const actor of actors) cast.addChild(actor);
  const props = depthProps(roomTexture);
  const couch = foreground(roomTexture);
  if (activeRoom === "portrait") {
    couch.zIndex = PORTRAIT_COUCH_DEPTH;
    props.push(couch);
  }
  const favoriteScenery = new FavoriteScenery(roomTexture, props[0]!);
  for (const prop of props) cast.addChild(prop);
  const letter = makeLetter({ paper: css("--grove-letter"), edge: css("--grove-letter-edge"), seal: css("--grove-letter-seal") });
  world.addChild(new Sprite(roomTexture), ambience.back, foliage.root, favoriteScenery.root, cast);
  if (activeRoom === "desktop") world.addChild(couch);
  world.addChild(letter, ambience.front);
  const puff = previous?.puff ?? residents.find((r) => r.cast.id === "puff")!;
  return { world, cast, residents, actors, ambience, foliage, letter, puff, props, favoriteScenery, lighting, dot };
}
export type Scene = Awaited<ReturnType<typeof makeScene>>;
