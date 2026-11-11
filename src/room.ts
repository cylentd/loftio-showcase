import "./tokens.css";
import "./style.css";
import "./settings.css";
import { applyWorldTheme } from './world-theme';
import { applyWorldArt } from './world-art';
import { installResidents } from './residents/view';
import { Application } from "pixi.js";
import { CAST } from "./cast";
import { SCENE_LABEL } from "./copy";
import { Look } from "./look";
import { installDebug } from "./debug";
import { Overlay } from "./overlay";
import { Runtime } from "./runtime";
import { css, makeScene } from "./scene";
import { installRoomAudio } from "./room-audio";
import { MAX_RESOLUTION } from "./tune";
import { SceneSettings } from "./scene-settings";
import { installSceneSettings } from "./scene-settings-view";
import { installResidentControls } from "./resident-controls";
import { FavoriteSpots } from "./favorite-spots";
import { installPostcard } from "./postcard";
import { installLighting } from "./lighting-view";
import { mountSceneActions } from "./scene-actions";
import { makeNowPlaying } from "./now-playing";
import { installIntro } from "./intro";
import { activeRoom, roomLayoutFor, setRoomLayout } from "./room-layout";
import { installRoomResize } from "./room-resize";
import './world-ui.css';
import './world-skins.css';
import './world-tray.css';

/** What a feature may touch. Features are passed in by the entry; this boot names none of them. */
export interface RoomContext {
  shell: HTMLElement;
  app: Application;
  scene: Awaited<ReturnType<typeof makeScene>>;
  runtime: Runtime;
  look: Look;
  overlay: Overlay;
  settings: SceneSettings;
  /** The room's music and rain; `playing` is false while they are muted, which sound effects follow. */
  audio: { readonly playing: boolean };
}

/** Installed once the room is built; `ready` runs after the intro hands over. */
export type RoomFeature = (room: RoomContext) => { ready?: () => void } | void;

async function start(intro: ReturnType<typeof installIntro>, features: readonly RoomFeature[]): Promise<void> {
  const shell = document.querySelector<HTMLElement>("#grove")!;
  const scroller = document.querySelector<HTMLElement>("#scroller")!;
  const worldEl = document.querySelector<HTMLElement>("#world")!;
  const params = new URLSearchParams(location.search);
  applyWorldTheme(document.documentElement, params.get('theme'));
  applyWorldArt(document.documentElement, document.baseURI);
  shell.setAttribute("aria-label", SCENE_LABEL);
  const app = new Application();
  await app.init({
    resizeTo: window, resolution: Math.min(devicePixelRatio, MAX_RESOLUTION),
    autoDensity: true, background: css("--color-bg"), antialias: true,
  });
  app.canvas.setAttribute("aria-hidden", "true");
  app.canvas.className = "stage";
  app.stage.eventMode = "none";
  shell.prepend(app.canvas);
  const settings = new SceneSettings({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  setRoomLayout(roomLayoutFor(innerWidth, innerHeight));
  const scene = await makeScene(settings, app.renderer);
  shell.dataset.room = activeRoom;
  app.stage.addChild(scene.world);
  const look = new Look(scroller, worldEl, scene.puff.cast.home.x);
  const roomAudio = installRoomAudio();
  const overlay = new Overlay(worldEl,
    [...CAST].sort((a, b) => a.home.x - b.home.x).map((c) => c.id),
    (id) => { if (!look.frozen) scene.residents.find((r) => r.cast.id === id)?.play("press"); },
    () => { if (!look.frozen) scene.puff.play("nod"); });
  const runtime = new Runtime(scene, look, overlay, params.has("busy"), settings);
  const residentControls = installResidentControls(scene, runtime, overlay, settings);
  const applySettings = () => {
    runtime.syncWander();
    runtime.update(0);
  };
  settings.subscribe(applySettings);
  installSceneSettings(settings, (trigger) => overlay.open(trigger));
  installLighting(settings);
  applySettings();
  const favorites = new FavoriteSpots(worldEl, look, settings, overlay, scene.favoriteScenery);
  const syncRoom = installRoomResize({ app, scene, runtime, settings, favorites, shell, scroller, applySettings });
  installPostcard(app);
  const updateResidents = installResidents(scene, runtime, overlay, residentControls, roomAudio);
  const tray = mountSceneActions(makeNowPlaying(roomAudio, () => look.frozen), document.querySelector<HTMLElement>(".postcard-action")!, settings,
    document.querySelector<HTMLElement>('.residents-trigger')!);
  const installed = features.map((feature) => feature({ shell, app, scene, runtime, look, overlay, settings, audio: roomAudio }));
  if (params.has("debug")) installDebug(shell, app, scene, runtime, look);
  runtime.update(0);
  app.ticker.add((ticker) => { runtime.update(ticker.deltaMS); favorites.update(); updateResidents(ticker.deltaMS); });
  if (document.hidden) app.stop();
  app.render();
  shell.dataset.ready = "true";
  intro.ready(() => { roomAudio.unlock(); tray.peek(); for (const feature of installed) feature?.ready?.(); });
  void syncRoom();
}

/** Shared entry: the intro, the room, and the features this entry chose. */
export function startRoom(features: readonly RoomFeature[] = []): void {
  const intro = installIntro(document.querySelector<HTMLElement>("#grove")!, new URLSearchParams(location.search).has("still"));
  void start(intro, features).catch(error => { console.error(error); intro.fail(); });
}
