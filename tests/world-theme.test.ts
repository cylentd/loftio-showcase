import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD_THEMES, applyWorldTheme } from '../src/world-theme.ts';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

for (const [name, theme] of Object.entries(WORLD_THEMES)) {
  test(`${name} body, secondary text and action text meet 4.5:1 contrast`, () => {
    for (const text of [theme.ink, theme.muted, theme.accent]) {
      const ratio = (luminance(theme.paper) + 0.05) / (luminance(text) + 0.05);
      assert.ok(ratio >= 4.5, `${name} ${text}: ${ratio}`);
    }
  });
}
const channels = (hex: string) => hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));

for (const [name, theme] of Object.entries(WORLD_THEMES)) {
  // The dock's song title and tile labels sit on the tray, which is drawn only from these two tones and mixes of them.
  test(`${name} dock labels and song title meet 4.5:1 on every tone of the tray (QA, 2026-11-06)`, () => {
    for (const surface of [theme.tray, theme.trayDeep]) {
      const [light, dark] = [surface, theme.trayInk].sort((a, b) => luminance(b) - luminance(a));
      const ratio = (luminance(light!) + 0.05) / (luminance(dark!) + 0.05);
      assert.ok(ratio >= 4.5, `${name} ${theme.trayInk} on ${surface}: ${ratio}`);
    }
  });
  test(`${name} tray tones are ordered channel by channel, so every mix of them stays between the two`, () => {
    const [light, deep] = [channels(theme.tray), channels(theme.trayDeep)];
    light.forEach((value, index) => assert.ok(value >= deep[index]!, `${name} channel ${index}: ${theme.tray} vs ${theme.trayDeep}`));
  });
}
test('unknown themes use the shared treehouse skin without changing behavior', () => {
  const values = new Map<string, string>();
  const root = { dataset: {}, style: { setProperty: (key: string, value: string) => values.set(key, value) } };
  applyWorldTheme(root as any, 'unknown');
  assert.deepEqual(root.dataset, { worldTheme: 'treehouse' });
  assert.equal(values.get('--world-paper'), '#fff4da');
});
