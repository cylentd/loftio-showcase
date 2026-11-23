// Component layer: a made resident's idle is a cutout sprite. The card draws it in the art slot, contained and centred (G4).
// The real creature module with a hand-made document, as resident-controls.test.ts does.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { artOf } from '../../src/holo-card/holo-card-faces.ts';
import { holoCreature } from '../../src/holo-card/holo-creature.ts';
import { cardSubjectFor } from '../../src/holo-card/holo-card-made-model.ts';
import { originalSubject } from '../../src/holo-card/holo-card-subject.ts';

class Node_ {
  className = ''; src = ''; dataset: Record<string, string> = {}; style = { setProperty() {}, transform: '', opacity: '', inset: '', borderRadius: '' };
  children: Node_[] = []; classList = { toggle() {} };
  append(...nodes: Node_[]) { this.children.push(...nodes); }
  setAttribute() {} getAnimations() { return []; } animate() { return {}; }
}
const original = { document: globalThis.document };
beforeEach(() => {
  Object.assign(globalThis, { document: { hidden: false, createElement: () => new Node_(), addEventListener() {}, removeEventListener() {} } });
});
afterEach(() => { Object.assign(globalThis, original); });

const made = cardSubjectFor({ id: 'made-1' }, { idle: '/made/preview.webp' }, 'Bean');
const find = (node: Node_, src: string): Node_ | undefined =>
  node.src === src ? node : node.children.map(child => find(child, src)).find(Boolean);

test('a made subject draws its idle in the art slot and marks it a cutout to contain', () => {
  const creature = holoCreature(artOf(made), 'Bean', false);
  assert.ok(find(creature.root as unknown as Node_, '/made/preview.webp'));
  assert.equal((creature.root as unknown as Node_).dataset.fit, 'cutout');
});

test('an original keeps its cropped painting framing', () => {
  const creature = holoCreature(artOf(originalSubject('sprout', '', null)), 'Sprout', false);
  assert.equal((creature.root as unknown as Node_).dataset.fit, undefined);
});
