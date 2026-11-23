// #442 phase 2, unit P1: the pure name-pack check. A pack names each synergy and special; one bad entry is dropped alone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NAME_MAX_LENGTH, SPECIALS, SYNERGIES } from '../../src/loadout/loadout-data.ts';
import { ORIGINAL_NAMES } from '../../src/loadout/loadout-copy.ts';
import { parseNamePack } from '../../src/loadout/loadout-name-model.ts';
import type { NameCheckOptions } from '../../src/loadout/loadout-name-model.ts';

const GOOD = { 'seed-burst': 'Seed Pop', meteor: 'Tea Party', mend: "Nana's Hug", ricochet: 'Ping-Pong' };
const noBlock: NameCheckOptions = { isBlocked: () => false };
const parse = (value: unknown, options = noBlock) => parseNamePack(value, options);

test('a good pack is kept entry for entry', () => {
  assert.deepEqual(parse(GOOD), GOOD);
});

test('one bad entry is dropped alone and the rest of the pack survives', () => {
  assert.deepEqual(parse({ ...GOOD, meteor: '<b>Hit</b>' }), { 'seed-burst': 'Seed Pop', mend: "Nana's Hug", ricochet: 'Ping-Pong' });
});

test('unknown keys are ignored', () => {
  assert.deepEqual(parse({ ...GOOD, 'future-ability': 'Zap', __proto__: { mend: 'x' } }), GOOD);
});

test('a curly apostrophe and a combining mark are allowed', () => {
  assert.deepEqual(parse({ mend: 'Nana’s Hug', meteor: 'Café' }), { mend: 'Nana’s Hug', meteor: 'Café' });
});

test('a decomposed name is stored composed (NFC)', () => {
  assert.deepEqual(parse({ meteor: 'Café' }), { meteor: 'Café' });
});

// Legitimate stacked marks must pass: a Hindi syllable with a vowel sign and a nasal mark (two marks on one base), a Vietnamese name.
test('a Hindi name with two stacked marks and a Vietnamese name are kept', () => {
  const hindi = 'कॉं';
  const vietnamese = 'Nguyễn Thị';
  assert.deepEqual(parse({ meteor: hindi, mend: vietnamese }), { meteor: hindi, mend: vietnamese });
});

test('a name made only of digits is kept', () => {
  assert.deepEqual(parse({ meteor: '007' }), { meteor: '007' });
});

test('a name is trimmed before it is kept', () => {
  assert.deepEqual(parse({ meteor: '  Big Hit  ' }), { meteor: 'Big Hit' });
});

test('a name of exactly the maximum length is kept, one longer is dropped', () => {
  const longest = 'a'.repeat(NAME_MAX_LENGTH);
  assert.deepEqual(parse({ meteor: longest, mend: longest + 'a' }), { meteor: longest });
});

test('length counts characters, not UTF-16 units, so a long non-Latin name is judged fairly', () => {
  const fits = '𠀋'.repeat(NAME_MAX_LENGTH); // astral letters: 2 UTF-16 units each
  assert.deepEqual(parse({ meteor: fits }), { meteor: fits });
});

const HOSTILE: [string, unknown][] = [
  ['markup', '<script>alert(1)</script>'],
  ['an angle bracket', 'a<b'],
  ['an ampersand entity', 'Tom &amp; Jerry'],
  ['a right-to-left override', 'Cloud‮Ray'],
  ['a zero-width space', 'Cloud​Ray'],
  ['a zero-width joiner', 'Cloud‍Ray'],
  ['an emoji', 'Seed Pop 🌱'],
  ['an empty string', ''],
  ['only spaces', '    '],
  ['a quote', 'Say "hi"'],
  ['a newline', 'Seed\nPop'],
  ['a base letter followed by 23 combining marks', 'a' + '́'.repeat(23)],
  ['three combining marks on a base with no composed form', 'x́̂̃'], // 'a' would compose with the first mark and leave only two
  ['a Hangul filler between letters', 'CloudㅤRay'],
  ['a name that is only a Hangul filler', 'ㅤ'],
  ['a variation selector', 'Seed️ Pop'],
  ['a combining grapheme joiner', 'Seed͏ Pop'],
  ['only apostrophes', "'’"],
  ['only hyphens', '---'],
  ['only spaces, apostrophes and hyphens', "- ' -"],
  ['a slash', 'a/b'],
  ['a number', 7],
  ['null', null],
  ['an object', { x: 1 }],
  ['an array', ['Seed Pop']],
];
for (const [name, bad] of HOSTILE) {
  test('a name that is ' + name + ' is dropped and the rest survives', () => {
    assert.deepEqual(parse({ ...GOOD, meteor: bad }), { 'seed-burst': 'Seed Pop', mend: "Nana's Hug", ricochet: 'Ping-Pong' });
  });
}

test('a name the blocklist refuses is dropped alone', () => {
  const isBlocked = (name: string) => name === 'Tea Party';
  assert.deepEqual(parse(GOOD, { isBlocked }), { 'seed-burst': 'Seed Pop', mend: "Nana's Hug", ricochet: 'Ping-Pong' });
});

test('the blocklist sees the cleaned name, not the raw one', () => {
  const seen: string[] = [];
  parse({ meteor: '  Big Hit  ' }, { isBlocked: (name) => { seen.push(name); return false; } });
  assert.deepEqual(seen, ['Big Hit']);
});

test('a blocklist that throws blocks the entry and never throws out', () => {
  const isBlocked = () => { throw new Error('boom'); };
  assert.equal(parse(GOOD, { isBlocked }), null);
});

for (const [name, bad] of [['null', null], ['undefined', undefined], ['a string', 'Seed Pop'], ['a number', 3], ['an array', [GOOD]], ['an empty object', {}], ['a pack of only bad names', { meteor: '' }]] as [string, unknown][]) {
  test('a pack that is ' + name + ' is absent', () => {
    assert.equal(parse(bad), null);
  });
}

test('a getter that throws makes the pack absent and never throws out', () => {
  const hostile = Object.defineProperty({}, 'meteor', { enumerable: true, get() { throw new Error('hostile'); } });
  assert.equal(parse(hostile), null);
});

test('the hand-written original names all pass the same checks', () => {
  const names = Object.values(ORIGINAL_NAMES).flatMap((row) => [row.synergy, row.special]);
  const pack = Object.fromEntries(names.map((name, i) => [[...SYNERGIES, ...SPECIALS][i]?.id as string, name]));
  assert.equal(Object.keys(parse(pack) ?? {}).length, names.length);
});
