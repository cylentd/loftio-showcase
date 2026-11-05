import { UPDATE_PRIORITY, type Ticker } from "pixi.js";
import { METER_LABEL } from "./copy";
import { METER_MS } from "./tune";

/**
 * Corner readout over the last half second: frames per second, mean frame interval, and mean CPU work per frame
 * (scene update plus Pixi's render submit). Work time shows headroom when the display caps the frame rate.
 */
export function makeMeter(host: HTMLElement, ticker: Ticker, moving: () => number): void {
  const out = document.createElement("output");
  out.className = "meter";
  out.setAttribute("aria-label", METER_LABEL);
  host.append(out);
  let frames = 0;
  let spent = 0;
  let work = 0;
  let started = 0;
  ticker.add(() => (started = performance.now()), undefined, UPDATE_PRIORITY.INTERACTION);
  ticker.add(
    (t) => {
      frames += 1;
      spent += t.deltaMS;
      work += performance.now() - started;
      if (spent < METER_MS) return;
      const fps = (frames * 1000) / spent;
      out.textContent = `${fps.toFixed(0)} fps · ${(spent / frames).toFixed(1)} ms · work ${(work / frames).toFixed(2)} ms · ${moving()} walking`;
      frames = 0;
      spent = 0;
      work = 0;
    },
    undefined,
    UPDATE_PRIORITY.UTILITY,
  );
}
