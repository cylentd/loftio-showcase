import type { Plugin } from 'vite';
export function publishWorld(gameRoot: string, output: string): Promise<void>;
export function worldRelease(): Plugin;
