import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface DdnsState {
  lastIp: string;
  updatedAt: string;
}

export async function readState(statePath: string): Promise<DdnsState | null> {
  try {
    const raw = await readFile(statePath, 'utf-8');
    return JSON.parse(raw) as DdnsState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function writeState(statePath: string, state: DdnsState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}
