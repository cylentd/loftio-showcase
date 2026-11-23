import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ELEMENTS } from '../../src/loadout/element-data.ts';
import { elementFor, parseLoadout } from '../../src/loadout/loadout-model.ts';
import type { Loadout } from '../../src/loadout/loadout-model.ts';

// The five ids the owner locked (game/prototypes/loft-rumble/VISION.md, 2026-11-20). The order is the contract: the roll
// indexes this list, so a reorder re-elements every made resident.
const LOCKED = ['bloom', 'splash', 'ember', 'spark', 'chaos'];
const BASE = { schemaVersion: 1, trait: 'springy', synergy: 'seed-burst', special: null };
const asLoadout = (value: unknown) => value as Loadout;

test('ELEMENTS lists the five locked ids in the locked order', () => {
  assert.deepEqual([...ELEMENTS], LOCKED);
});

for (const element of LOCKED) {
  test('parseLoadout keeps the valid element ' + element, () => {
    assert.deepEqual(parseLoadout({ ...BASE, element }), { ...BASE, element });
  });
}

const BAD_ELEMENTS: [string, unknown][] = [
  ['an unknown id', 'fire'], ['an id in the wrong case', 'Bloom'], ['a number', 3], ['null', null], ['an object', { id: 'bloom' }],
  ['an inherited key name', '__proto__'], ['an empty string', ''],
];
for (const [name, element] of BAD_ELEMENTS) {
  test('parseLoadout drops ' + name + ' as the element and keeps the rest of the loadout', () => {
    assert.deepEqual(parseLoadout({ ...BASE, element }), BASE);
  });
}

test('parseLoadout leaves a loadout with no element key without one', () => {
  assert.equal('element' in (parseLoadout(BASE) ?? {}), false);
});

test('parseLoadout does not throw and drops only the element when the element getter throws', () => {
  const hostile = Object.defineProperty({ ...BASE }, 'element', { enumerable: true, get() { throw new Error('hostile getter'); } });
  assert.deepEqual(parseLoadout(hostile), BASE);
});

test('elementFor returns the stored element, whatever the id would roll', () => {
  assert.equal(elementFor({ ...BASE, element: 'bloom' } as Loadout, 'resident:fixture-mossy'), 'bloom');
});

// Pinned values, worked out by hand with FNV-1a 32-bit over UTF-16 code units, then hash % 5 into ELEMENTS (2026-11-20).
// A change to the hash or the list re-elements every made resident, so a change here is a migration, and Rumble (#481) may change the rule.
const PINNED: [string, string][] = [
  ['resident:fixture-mossy', 'ember'], ['resident:fixture-pip', 'spark'], ['resident:fixture-nova', 'chaos'], ['', 'splash'],
  // UTF-8 bytes of this id would roll 'splash': the code-unit hash is part of the rule.
  ['résumé-🌱', 'chaos'],
];
for (const [id, element] of PINNED) {
  test('elementFor rolls "' + id + '" to ' + element + ' when the loadout stores none', () => {
    assert.equal(elementFor(BASE as Loadout, id), element);
  });
}

for (const [name, element] of BAD_ELEMENTS) {
  test('elementFor rolls from the id when the stored element is ' + name, () => {
    assert.equal(elementFor(asLoadout({ ...BASE, element }), 'resident:fixture-pip'), 'spark');
  });
}
