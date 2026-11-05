/** The song-position wave in the now-playing pill. Pixels are CSS pixels inside the wave's own SVG. */
export const SONG_WAVE = {
  height: 12, // the SVG box; tall enough for the wave plus the 3 px thumb radius
  amplitude: 2.5, // a ripple, not a scribble: under half the box at rest height
  wavelength: 14, // about three crests across the narrowest phone pill
  sampleStep: 1.5, // path points per wavelength ≈ 9, smooth at 2× zoom
  speed: 0.6, // wavelengths per second: drifts like water, slower than the rain
  settleMs: 300, // how long the wave takes to calm when paused or rise on play
  keyStepSeconds: 5, // arrow keys skip this far through the song
};
