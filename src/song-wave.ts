import type { Soundtrack } from "./audio-model";
import { MUSIC } from "./copy";
import { SONG_WAVE } from "./song-wave-data";
import { clockText, settleAmplitude, songFraction, wavePath } from "./song-wave-model";

const SVG = "http://www.w3.org/2000/svg";

/**
 * Where the song is: the played part ripples while music plays and calms to a line when paused.
 * A transparent native slider sits on top, so dragging, arrow keys and screen readers all work.
 */
export function makeSongWave(music: Soundtrack, element: HTMLMediaElement, frozen: () => boolean): HTMLElement {
  const box = document.createElement("div"); box.className = "song-wave";
  const svg = document.createElementNS(SVG, "svg"); svg.setAttribute("aria-hidden", "true");
  const rest = document.createElementNS(SVG, "path"); rest.classList.add("song-wave-rest");
  const played = document.createElementNS(SVG, "path"); played.classList.add("song-wave-played");
  const thumb = document.createElementNS(SVG, "circle"); thumb.classList.add("song-wave-thumb");
  svg.append(rest, played, thumb);
  const slider = document.createElement("input"); slider.type = "range"; slider.min = "0"; slider.step = "any";
  slider.setAttribute("aria-label", MUSIC.position);
  box.append(svg, slider);

  const middle = SONG_WAVE.height / 2;
  let width = 0, amplitude = 0, phase = 0, last = performance.now(), frame = 0, dragging = false;
  const draw = () => {
    const { current, duration } = music.position;
    const known = Number.isFinite(duration) && duration > 0;
    slider.max = String(known ? duration : 0); slider.disabled = !known;
    if (!dragging) slider.value = String(current);
    slider.setAttribute("aria-valuetext", MUSIC.positionText(clockText(current), clockText(known ? duration : NaN)));
    const end = width * songFraction(current, duration);
    played.setAttribute("d", wavePath({ end, middle, amplitude, wavelength: SONG_WAVE.wavelength, phase }));
    rest.setAttribute("d", `M${end} ${middle} L${width} ${middle}`);
    thumb.setAttribute("cx", String(end)); thumb.setAttribute("cy", String(middle));
  };
  const tick = (now: number) => {
    const elapsed = now - last; last = now;
    amplitude = settleAmplitude(amplitude, music.playing ? SONG_WAVE.amplitude : 0, elapsed);
    if (music.playing && !frozen()) phase = (phase + SONG_WAVE.speed * elapsed / 1000) % 1;
    draw();
    frame = music.playing || amplitude > 0 ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); } };
  new ResizeObserver(() => {
    width = svg.clientWidth; svg.setAttribute("viewBox", `0 0 ${width} ${SONG_WAVE.height}`); draw();
  }).observe(svg);
  music.subscribe(() => { wake(); draw(); });
  slider.addEventListener("input", () => { music.seek(slider.valueAsNumber); draw(); });
  slider.addEventListener("pointerdown", () => { dragging = true; });
  slider.addEventListener("change", () => { dragging = false; });
  slider.addEventListener("keydown", (event) => {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (direction === undefined) return;
    event.preventDefault(); music.seek(music.position.current + direction * SONG_WAVE.keyStepSeconds); draw();
  });
  // Paused, nothing animates, so the element's own events keep the line current (a new song, a known length, a seek).
  for (const name of ["timeupdate", "loadedmetadata", "seeked", "emptied"]) element.addEventListener(name, draw);
  return box;
}
