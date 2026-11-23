// #442 P2: the default blocklist parseNamePack applies. A blocked name is dropped alone; ordinary names pass.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNameBlocked } from '../../src/loadout/loadout-blocklist-model.ts';
import { parseNamePack } from '../../src/loadout/loadout-name-model.ts';

const BLOCKED = ['Nazi Pop', 'HITLER', 'n1gger', 'Mickey Mouse', 'Hello-Kitty', 'Pika chu Zap', 'Fuck Yeah', 'Super Mari0'];
for (const name of BLOCKED) {
  test(`${name} is blocked`, () => {
    assert.equal(isNameBlocked(name), true);
  });
}

const FINE = ['Seed Pop', 'Marvelous Mend', 'Classic Cheer', 'Scunthorpe Spin', 'Nana’s Hug', 'Mariposa', 'Cocktail Party'];
for (const name of FINE) {
  test(`${name} is not blocked`, () => {
    assert.equal(isNameBlocked(name), false);
  });
}

// Written as escapes so the lookalike letters are visible: а = Cyrillic a, і = Cyrillic i, у = Cyrillic u, α = Greek alpha.
const HOSTILE_LOOKALIKES: [string, string][] = [
  ['Cyrillic a in a Latin word', 'nаzi'],
  ['Cyrillic i in a Latin word', 'Hіtler'],
  ['Cyrillic u in a Latin word', 'fуck'],
  ['Greek alpha in a Latin word', 'Nαzi'],
  ['a mixed word beside a clean one', 'Moth Mаgic'],
  ['a mixed word that is no blocked word', 'Wаrm Hug'],
];
const BLOCKED_SPLIT: [string, string][] = [
  ['a hyphen inside a blocked word', 'Fu-ck'],
  ['an apostrophe inside a blocked word', "Fu'ck"],
  ['a curly apostrophe inside a blocked word', 'Sh’it'],
  ['hyphens inside a blocked word beside a clean one', 'Big Co-ck Pop'],
];
for (const [label, name] of [...HOSTILE_LOOKALIKES, ...BLOCKED_SPLIT]) {
  test(`${label} is blocked: ${name}`, () => {
    assert.equal(isNameBlocked(name), true);
  });
}

const BENIGN_ADDED: [string, string][] = [
  ['whole-word Cyrillic', 'Привет Мир'],
  ['whole-word Greek', 'Καλημέρα'],
  ['a Latin word holding a blocked word', 'Cockatoo'],
  ['a Latin word holding a blocked word, again', 'Scunthorpe'],
  ['two ordinary words', 'Classic Cocktail'],
  ['a hyphenated compound of clean words', 'Well-Known Day'],
  ['digits beside Latin letters', 'Pop 2 Pop'],
  ['an accented Latin word', 'Café Pop'],
];
for (const [label, name] of BENIGN_ADDED) {
  test(`${label} is not blocked: ${name}`, () => {
    assert.equal(isNameBlocked(name), false);
  });
}

test('parseNamePack drops a mixed-script name and keeps a whole-word non-Latin one', () => {
  assert.deepEqual(parseNamePack({ meteor: 'Wаrm Hug', mend: 'Привет' }), { mend: 'Привет' });
});

test('parseNamePack applies the default blocklist and drops the blocked name alone', () => {
  assert.deepEqual(parseNamePack({ meteor: 'Hitler Slam', mend: 'Warm Hug' }), { mend: 'Warm Hug' });
});

test('an explicit blocklist replaces the default', () => {
  assert.deepEqual(parseNamePack({ meteor: 'Hitler Slam' }, { isBlocked: () => false }), { meteor: 'Hitler Slam' });
});
