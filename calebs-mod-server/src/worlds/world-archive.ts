import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as yazl from 'yazl';
import * as yauzl from 'yauzl';
import { contained, hashFile, requireSpace, safeRelative } from './world-paths';
import type { WorldRecord } from './world-store';

export interface ArchiveSource {
  name: string;
  file?: string;
  data?: Buffer;
}
export interface WorldArchiveManifest {
  format: 'calebs-world';
  version: 1;
  kind: 'manual' | 'automatic' | 'migration';
  createdAt: number;
  world: WorldRecord;
  checksums: Record<string, { sha256: string; size: number }>;
}
const MAX_BYTES = 50 * 1024 ** 3;
const MAX_FILES = 200000;
const MAX_MANIFEST = 32 * 1024 ** 2;

export async function writeArchive(
  destination: string,
  world: WorldRecord,
  kind: WorldArchiveManifest['kind'],
  sources: ArchiveSource[],
  progress?: (done: number, total: number) => void,
) {
  const checksums: WorldArchiveManifest['checksums'] = {};
  const seen = new Set<string>();
  let bytes = 0;
  let done = 0;
  for (const source of sources) {
    safeRelative(source.name);
    if (seen.has(source.name.toLowerCase()) || source.name === 'manifest.json')
      throw new Error('Duplicate archive path');
    seen.add(source.name.toLowerCase());
    const size = source.data
      ? source.data.length
      : fs.statSync(source.file!).size;
    checksums[source.name] = {
      sha256: source.data
        ? crypto.createHash('sha256').update(source.data).digest('hex')
        : await hashFile(source.file!),
      size,
    };
    bytes += size;
    if (++done % 100 === 0 || done === sources.length)
      progress?.(done, sources.length);
  }
  if (sources.length > MAX_FILES || bytes > MAX_BYTES)
    throw new Error('Archive exceeds supported size');
  requireSpace(path.dirname(destination), bytes);
  const manifest: WorldArchiveManifest = {
    format: 'calebs-world',
    version: 1,
    kind,
    createdAt: Date.now(),
    world,
    checksums,
  };
  const zip = new yazl.ZipFile();
  const temporary = destination + '.partial';
  const complete = pipeline(
    zip.outputStream,
    fs.createWriteStream(temporary, { flags: 'wx' }),
  );
  // Attach immediately so failures during asynchronous archive production are handled.
  complete.catch(() => undefined);
  zip.on('error', (error) => (zip.outputStream as Readable).destroy(error));
  try {
    for (const source of sources) {
      if (source.data) zip.addBuffer(source.data, source.name);
      else zip.addFile(source.file!, source.name);
    }
    zip.addBuffer(Buffer.from(JSON.stringify(manifest)), 'manifest.json');
    zip.end({ forceZip64Format: true, comment: '' });
    await complete;
    await readArchive(temporary);
    const handle = fs.openSync(temporary, 'r+');
    try {
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(temporary, destination);
    return {
      manifest,
      sha256: await hashFile(destination),
      size: fs.statSync(destination).size,
    };
  } catch (error) {
    (zip.outputStream as Readable).destroy();
    await complete.catch(() => undefined);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

// Both verification and extraction stream every entry. All contents must be
// accounted for by the signed-off checksum inventory before a world is registered.
export async function readArchive(
  file: string,
  destination?: string,
): Promise<WorldArchiveManifest> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, autoClose: true, validateEntrySizes: true },
      (error, zip) => (error ? reject(error) : resolve(zip!)),
    ),
  );
  const observed: WorldArchiveManifest['checksums'] = {};
  const seen = new Set<string>();
  let manifest: WorldArchiveManifest | undefined;
  let bytes = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          const directory = entry.fileName.endsWith('/');
          const name = safeRelative(
            directory ? entry.fileName.slice(0, -1) : entry.fileName,
          );
          if (seen.has(name.toLowerCase()))
            throw new Error('Duplicate archive destination');
          seen.add(name.toLowerCase());
          if (seen.size > MAX_FILES + 1)
            throw new Error('Too many archive entries');
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (mode && mode !== 0x8000 && mode !== 0x4000)
            throw new Error('Archive links and special files are forbidden');
          if (entry.isEncrypted())
            throw new Error('Encrypted archives are unsupported');
          if (directory) {
            zip.readEntry();
            return;
          }
          if (
            name !== 'manifest.json' &&
            !/^(data|pack-files|private)\//.test(name)
          )
            throw new Error('Unexpected archive entry');
          bytes += entry.uncompressedSize;
          if (
            bytes > MAX_BYTES ||
            (name === 'manifest.json' && entry.uncompressedSize > MAX_MANIFEST)
          )
            throw new Error('Archive expands beyond supported limits');
          if (destination) requireSpace(destination, entry.uncompressedSize);
          const input = await new Promise<fs.ReadStream>((res, rej) =>
            zip.openReadStream(entry, (error, stream) =>
              error ? rej(error) : res(stream as fs.ReadStream),
            ),
          );
          const hash = crypto.createHash('sha256');
          let size = 0;
          const chunks: Buffer[] = [];
          const target =
            destination && name !== 'manifest.json'
              ? contained(destination, name)
              : undefined;
          let handle: fs.promises.FileHandle | undefined;
          if (target) {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            handle = await fs.promises.open(target, 'wx');
          }
          try {
            for await (const chunk of input) {
              size += chunk.length;
              if (size > entry.uncompressedSize)
                throw new Error('Entry size mismatch');
              hash.update(chunk);
              if (name === 'manifest.json') chunks.push(chunk);
              if (handle) await handle.writeFile(chunk);
            }
          } finally {
            await handle?.close();
          }
          if (size !== entry.uncompressedSize)
            throw new Error('Entry size mismatch');
          if (name === 'manifest.json')
            manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          else observed[name] = { sha256: hash.digest('hex'), size };
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
    if (
      !manifest ||
      manifest.format !== 'calebs-world' ||
      manifest.version !== 1 ||
      !manifest.world ||
      !manifest.checksums ||
      Array.isArray(manifest.checksums)
    )
      throw new Error('Unsupported world backup format');
    if (Object.keys(observed).length !== Object.keys(manifest.checksums).length)
      throw new Error('Incomplete archive inventory');
    for (const [name, expected] of Object.entries(manifest.checksums)) {
      const actual = observed[name];
      if (
        !actual ||
        actual.sha256 !== expected.sha256 ||
        actual.size !== expected.size
      )
        throw new Error(`Backup checksum mismatch: ${name}`);
      if (name.startsWith('pack-files/') && name.slice(11) !== actual.sha256)
        throw new Error('Pack content hash mismatch');
    }
    return manifest;
  } finally {
    zip.close();
  }
}
