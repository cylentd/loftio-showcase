/**
 * Preloaded by register.ts for every game test run. A slipped live call fails loudly instead of
 * leaving the machine. Unlike the root guard (tests/support/no-network.ts), loopback stays open:
 * game tests start real http servers on 127.0.0.1 and talk to them.
 */
import dgram from "node:dgram";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";

const LOOPBACK_V4 = /^127(\.\d{1,3}){3}$/;
const LOOPBACK_NAMES = new Set(["localhost", "::1", "[::1]", "0:0:0:0:0:0:0:1"]);

const refuse = (): never => {
  throw new Error("network blocked in tests: use fixtures or a loopback server");
};

export const isLoopback = (host: unknown): boolean => {
  if (typeof host !== "string") return false;
  const name = host.toLowerCase();
  return LOOPBACK_V4.test(name) || LOOPBACK_NAMES.has(name);
};

/** The host a net.connect argument list targets. A unix socket path or port-only call is local. */
const connectHost = (raw: unknown[]): unknown => {
  // net.connect hands Socket.connect its already-normalized [options, callback] array.
  const args = Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw;
  const first = args[0];
  if (first && typeof first === "object") {
    const options = first as { path?: string; host?: string };
    return options.path !== undefined ? "localhost" : (options.host ?? "localhost");
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) return "localhost";
  return typeof args[1] === "string" ? args[1] : "localhost";
};

const realFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const raw = typeof input === "string" || input instanceof URL ? input : input.url;
  let host: string;
  try {
    host = new URL(raw, "http://localhost").hostname;
  } catch {
    return refuse();
  }
  return isLoopback(host) ? realFetch(input, init) : Promise.reject(new Error("network blocked in tests: use fixtures or a loopback server"));
}) as typeof fetch;

const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  if (!isLoopback(connectHost(args))) refuse();
  return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;

const realLookup = dns.lookup;
dns.lookup = ((hostname: string, ...rest: unknown[]) => {
  if (!isLoopback(hostname)) refuse();
  return (realLookup as (...a: unknown[]) => unknown)(hostname, ...rest);
}) as typeof dns.lookup;

/** Every other name lookup. dns.promises and Resolver are blocked too, since they bypass dns.lookup. */
const blockAll = (target: object): void => {
  for (const name of Object.getOwnPropertyNames(target)) {
    const value = (target as Record<string, unknown>)[name];
    if (typeof value === "function" && /^(lookupService|resolve|reverse)/.test(name)) {
      (target as Record<string, unknown>)[name] = refuse;
    }
  }
};

blockAll(dns);
blockAll(dns.promises);
blockAll(dns.Resolver.prototype);
blockAll(dns.promises.Resolver.prototype);
dgram.createSocket = refuse as unknown as typeof dgram.createSocket;
syncBuiltinESMExports();
