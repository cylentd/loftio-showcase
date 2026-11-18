import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invitationFile, shareFile } from '../../src/visits/share.ts';

const invitation = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Sprout', png: 'pixels' };
test('portable file contains only invitation fields and uses a fixed safe filename', async () => {
  const file = invitationFile(invitation);
  assert.equal(file.name, 'loftio-invitation.loftio-visit');
  assert.deepEqual(JSON.parse(await file.text()), invitation);
});
test('supported native sharing receives the prepared file; no fallback download', async () => {
  const file = invitationFile(invitation), sent: File[] = []; let downloads = 0;
  const result = await shareFile(file, { canShare: () => true, share: async data => { sent.push(...data.files!); } }, () => { downloads++; });
  assert.equal(result, 'shared'); assert.deepEqual(sent, [file]); assert.equal(downloads, 0);
});
test('unsupported native file sharing requests exactly one download', async () => {
  const file = invitationFile(invitation), downloads: File[] = [];
  assert.equal(await shareFile(file, { canShare: () => false }, item => { downloads.push(item); }), 'downloaded');
  assert.deepEqual(downloads, [file]);
});
for (const [name, expected] of [['AbortError', 'cancelled'], ['NotAllowedError', 'failed']]) {
  test(`${name} is not success and does not silently download`, async () => {
    let downloads = 0;
    const result = await shareFile(invitationFile(invitation), { canShare: () => true, share: async () => { throw new DOMException('share stopped', name); } }, () => { downloads++; });
    assert.equal(result, expected); assert.equal(downloads, 0);
  });
}
