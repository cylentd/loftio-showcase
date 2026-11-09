// tray / trayDeep: the lightest and darkest tones of the music dock's surface. Every skin draws the dock from these two
// and mixes of them, so trayInk (song title, tile labels) is contrast-checked against both (tests/world-theme.test.ts).
export const WORLD_THEMES = {
  base: { paper: '#fff8e9', ink: '#30281f', muted: '#625342', wood: '#715032', edge: '#9a754b', accent: '#37563e', selected: '#e4ebd8',
    tray: '#7f5831', trayDeep: '#5a3b24', trayInk: '#fff8e9' },
  treehouse: { paper: '#fff4da', ink: '#35271d', muted: '#69503a', wood: '#684327', edge: '#a57942', accent: '#365335', selected: '#e0e7c8',
    tray: '#7f5831', trayDeep: '#5a3b24', trayInk: '#fff8e9' },
  coffee: { paper: '#fff4e9', ink: '#382821', muted: '#715343', wood: '#704333', edge: '#a46c48', accent: '#75422d', selected: '#f2decc',
    tray: '#f2ebe6', trayDeep: '#e8d3c2', trayInk: '#382821' },
  beach: { paper: '#fffbea', ink: '#253d40', muted: '#52696a', wood: '#836a44', edge: '#aa9166', accent: '#246165', selected: '#dcebe3',
    tray: '#e9d8b4', trayDeep: '#cbb48a', trayInk: '#253d40' },
} as const;
export type WorldTheme = keyof typeof WORLD_THEMES;

const cssName = (key: string) => '--world-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());

export function applyWorldTheme(root: HTMLElement, choice: string | null) {
  const id: WorldTheme = choice && Object.hasOwn(WORLD_THEMES, choice) ? choice as WorldTheme : 'treehouse';
  root.dataset.worldTheme = id;
  for (const [key, value] of Object.entries(WORLD_THEMES[id])) root.style.setProperty(cssName(key), value);
}
