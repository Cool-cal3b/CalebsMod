import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export function safeRelative(value: string): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    value.includes('\0')
  )
    throw new Error('Invalid relative path');
  const parts = value.split('/');
  if (
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[<>:"|?*\x00-\x1f]/.test(p) ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
    )
  )
    throw new Error(`Unsafe path: ${value}`);
  return value;
}

export function contained(root: string, relative: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, safeRelative(relative));
  if (!target.startsWith(resolvedRoot + path.sep))
    throw new Error('Path escapes storage');
  let current = resolvedRoot;
  for (const part of relative.split('/')) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error('Links are not allowed');
    current = path.join(current, part);
  }
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
    throw new Error('Links are not allowed');
  return target;
}

export function listFiles(root: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(root)) return result;
  function walk(relative: string) {
    const dir = relative ? contained(root, relative) : root;
    if (fs.lstatSync(dir).isSymbolicLink())
      throw new Error('Links are not allowed');
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      safeRelative(name);
      if (entry.isSymbolicLink()) throw new Error(`Link found: ${name}`);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) result.push(name);
      else throw new Error(`Unsupported file: ${name}`);
    }
  }
  walk('');
  return result.sort();
}

export async function hashFile(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function requireSpace(directory: string, bytes: number) {
  const stats = fs.statfsSync(directory);
  if (stats.bavail * stats.bsize < bytes + 256 * 1024 * 1024)
    throw new Error('Not enough free disk space');
}
