import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import dns from 'node:dns';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

// The game suite preloads game/tests/support/no-network.ts through register.ts.
// It refuses every host except loopback.

const BLOCKED = /network blocked in tests/;

test('fetch to a non-loopback host is refused', async () => {
  await assert.rejects(() => fetch('https://example.com/'), BLOCKED);
});

test('fetch to a host that only looks like loopback is refused', async () => {
  await assert.rejects(() => fetch('http://127.0.0.1.example.com/'), BLOCKED);
});

test('a raw socket to a non-loopback address is refused', () => {
  assert.throws(() => net.connect({ host: '93.184.216.34', port: 80 }), BLOCKED);
});

test('a raw socket to a non-loopback name is refused', () => {
  assert.throws(() => net.connect({ host: 'example.com', port: 80 }), BLOCKED);
});

test('a name lookup for a non-loopback host is refused', () => {
  assert.throws(() => dns.lookup('example.com', () => undefined), BLOCKED);
});

test('a datagram socket is refused', () => {
  assert.throws(() => dgram.createSocket('udp4'), BLOCKED);
});

test('a loopback server answers fetch on 127.0.0.1 and localhost', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    for (const host of ['127.0.0.1', 'localhost']) {
      const res = await fetch(`http://${host}:${port}/`);
      assert.equal(await res.text(), 'ok');
    }
  } finally {
    server.close();
  }
});

test('a raw socket to loopback connects', async () => {
  const server = net.createServer((s) => s.end('hi'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const s = net.connect({ host: '127.0.0.1', port });
      let buf = '';
      s.on('data', (d) => (buf += d));
      s.on('end', () => resolve(buf));
      s.on('error', reject);
    });
    assert.equal(data, 'hi');
  } finally {
    server.close();
  }
});
