// Types for rumble-release.mjs; shapes read from that script, keep them in step with it.
import type { Plugin } from 'vite';

export interface RumbleRequest { url?: string; method?: string }
export interface RumbleResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: Buffer | string): unknown;
}

export function publishRumble(gameRoot: string, output: string): Promise<void>;
export function resolveRumbleRequest(gameRoot: string, url: string, manifestFile?: string): { source: string; target: string } | null;
export function rumbleDevMiddleware(gameRoot: string, manifestFile?: string):(req: RumbleRequest, res: RumbleResponse, next: (error?: unknown) => void) => Promise<void>;
export function rumbleRelease(): Plugin;
