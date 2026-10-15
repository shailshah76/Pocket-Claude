import { readdir, realpath, stat, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { loadConfig } from './config.js';
import type { FsListing, FsEntry } from '../shared/types.js';

const MAX_READ = 1_000_000;

export class FsError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

/** Expand ~, resolve against `base`, follow symlinks, and require the result to sit inside an allowed root. */
export async function safePath(input: string, base?: string): Promise<string> {
  let p = (input || '').trim() || '~';
  if (p === '~' || p.startsWith('~/')) p = join(homedir(), p.slice(1));
  if (!isAbsolute(p)) p = resolve(base || loadConfig().defaultDir, p);
  let real: string;
  try {
    real = await realpath(p);
  } catch {
    throw new FsError(404, `No such file or folder: ${p}`);
  }
  if (!within(real)) throw new FsError(403, `Outside allowed folders: ${real}`);
  return real;
}

function within(p: string): boolean {
  return loadConfig().roots.some((root) => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep));
}

export async function list(path: string, base: string | undefined, showHidden: boolean): Promise<FsListing> {
  const real = await safePath(path, base);
  if (!(await stat(real)).isDirectory()) throw new FsError(400, `Not a folder: ${real}`);
  const dirents = await readdir(real, { withFileTypes: true }).catch((e) => {
    throw new FsError(403, e.code === 'EPERM' || e.code === 'EACCES' ? `macOS blocked access to ${real}` : String(e.message));
  });
  const entries: FsEntry[] = [];
  await Promise.all(
    dirents
      .filter((d) => showHidden || !d.name.startsWith('.'))
      .map(async (d) => {
        try {
          const s = await stat(join(real, d.name));
          entries.push({ name: d.name, type: s.isDirectory() ? 'dir' : 'file', size: s.size, mtime: s.mtimeMs });
        } catch {
          /* broken symlink etc. */
        }
      }),
  );
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'dir' ? -1 : 1));
  const parent = dirname(real);
  return { path: real, parent: parent !== real && within(parent) ? parent : null, entries };
}

export async function readText(path: string): Promise<{ path: string; text?: string; binary?: boolean; truncated?: boolean; size: number }> {
  const real = await safePath(path);
  const s = await stat(real);
  if (!s.isFile()) throw new FsError(400, `Not a file: ${real}`);
  const fh = await open(real, 'r');
  try {
    const buf = Buffer.alloc(Math.min(s.size, MAX_READ));
    await fh.read(buf, 0, buf.length, 0);
    if (buf.subarray(0, 8000).includes(0)) return { path: real, binary: true, size: s.size };
    return { path: real, text: buf.toString('utf8'), truncated: s.size > MAX_READ, size: s.size };
  } finally {
    await fh.close();
  }
}
