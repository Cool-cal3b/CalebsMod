import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { PackManifestDto, ModDto } from './dto/manifest.dto';
import { CreatePackDto, UpdatePackDto } from './dto/pack.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class ModpackService {
  private readonly modsStorePath: string;
  private readonly cachePath: string;

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {
    this.modsStorePath = path.join(process.cwd(), 'storage', 'mods-store');
    this.cachePath = path.join(process.cwd(), 'storage', 'cache');

    if (!fs.existsSync(this.modsStorePath)) {
      fs.mkdirSync(this.modsStorePath, { recursive: true });
    }
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  createPack(dto: CreatePackDto, user?: string) {
    const packId = this.generatePackId(dto.name);
    const now = Date.now();

    this.db
      .prepare(
        `
      INSERT INTO packs (id, name, minecraft_version, loader_type, loader_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        packId,
        dto.name,
        dto.minecraftVersion,
        dto.loaderType,
        dto.loaderVersion,
        now,
        now,
      );

    this.db
      .prepare(
        `
      INSERT INTO pack_versions (pack_id, version, created_at)
      VALUES (?, ?, ?)
    `,
      )
      .run(packId, '1.0.0', now);

    this.db.logAudit('create', 'pack', packId, user);

    return { packId, version: '1.0.0' };
  }

  updatePack(packId: string, dto: UpdatePackDto, user?: string) {
    const updates: string[] = [];
    const values: any[] = [];

    if (dto.name) {
      updates.push('name = ?');
      values.push(dto.name);
    }
    if (dto.minecraftVersion) {
      updates.push('minecraft_version = ?');
      values.push(dto.minecraftVersion);
    }
    if (dto.loaderType) {
      updates.push('loader_type = ?');
      values.push(dto.loaderType);
    }
    if (dto.loaderVersion) {
      updates.push('loader_version = ?');
      values.push(dto.loaderVersion);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(packId);

    this.db
      .prepare(
        `
      UPDATE packs
      SET ${updates.join(', ')}
      WHERE id = ?
    `,
      )
      .run(...values);

    this.db.logAudit('update', 'pack', packId, user, dto);
  }

  async addModByUrl(
    packId: string,
    url: string,
    modId?: string,
    modVersion?: string,
    required = true,
    user?: string,
  ) {
    const tempFile = path.join(this.cachePath, `temp-${Date.now()}.jar`);

    try {
      const response = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(tempFile);

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      return await this.addModByFile(
        packId,
        tempFile,
        path.basename(url),
        url,
        modId,
        modVersion,
        required,
        user,
      );
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  async addModByFile(
    packId: string,
    filePath: string,
    fileName: string,
    originalUrl?: string,
    modId?: string,
    modVersion?: string,
    required = true,
    user?: string,
  ) {
    const fileBuffer = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    const targetPath = path.join(this.modsStorePath, `${sha256}.jar`);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(filePath, targetPath);
    }

    const existingMod = this.db
      .prepare('SELECT sha256 FROM mods WHERE sha256 = ?')
      .get(sha256);

    if (!existingMod) {
      this.db
        .prepare(
          `
        INSERT INTO mods (sha256, file_name, file_size, original_url, mod_id, mod_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          sha256,
          fileName,
          fileSize,
          originalUrl,
          modId,
          modVersion,
          Date.now(),
        );
    }

    const latestVersion = this.db
      .prepare(
        `
      SELECT id FROM pack_versions WHERE pack_id = ? ORDER BY id DESC LIMIT 1
    `,
      )
      .get(packId) as any;

    if (latestVersion) {
      this.db
        .prepare(
          `
        INSERT OR IGNORE INTO pack_version_mods (pack_version_id, mod_sha256, required)
        VALUES (?, ?, ?)
      `,
        )
        .run(latestVersion.id, sha256, required ? 1 : 0);
    }

    this.db
      .prepare('UPDATE packs SET updated_at = ? WHERE id = ?')
      .run(Date.now(), packId);
    this.db.logAudit('add_mod', 'pack', packId, user, { sha256, fileName });

    return { sha256, fileName, fileSize };
  }

  removeMod(packId: string, sha256: string, user?: string) {
    const latestVersion = this.db
      .prepare(
        `
      SELECT id FROM pack_versions WHERE pack_id = ? ORDER BY id DESC LIMIT 1
    `,
      )
      .get(packId) as any;

    if (latestVersion) {
      this.db
        .prepare(
          `
        DELETE FROM pack_version_mods
        WHERE pack_version_id = ? AND mod_sha256 = ?
      `,
        )
        .run(latestVersion.id, sha256);
    }

    this.db
      .prepare('UPDATE packs SET updated_at = ? WHERE id = ?')
      .run(Date.now(), packId);
    this.db.logAudit('remove_mod', 'pack', packId, user, { sha256 });
  }

  getManifest(packId: string): PackManifestDto | null {
    const pack = this.db
      .prepare(
        `
      SELECT * FROM packs WHERE id = ?
    `,
      )
      .get(packId) as any;

    if (!pack) {
      return null;
    }

    const latestVersion = this.db
      .prepare(
        `
      SELECT * FROM pack_versions WHERE pack_id = ? ORDER BY id DESC LIMIT 1
    `,
      )
      .get(packId) as any;

    if (!latestVersion) {
      return null;
    }

    const mods = this.db
      .prepare(
        `
      SELECT m.*, pvm.required
      FROM mods m
      JOIN pack_version_mods pvm ON m.sha256 = pvm.mod_sha256
      WHERE pvm.pack_version_id = ?
    `,
      )
      .all(latestVersion.id) as any[];

    return {
      packName: pack.name,
      packId: pack.id,
      version: latestVersion.version,
      minecraftVersion: pack.minecraft_version,
      loader: {
        type: pack.loader_type,
        version: pack.loader_version,
      },
      mods: mods.map((m) => ({
        sha256: m.sha256,
        fileName: m.file_name,
        fileSize: m.file_size,
        originalUrl: m.original_url,
        modId: m.mod_id,
        modVersion: m.mod_version,
        required: m.required === 1,
      })),
      updatedAt: pack.updated_at,
    };
  }

  getModFile(sha256: string): string | null {
    const filePath = path.join(this.modsStorePath, `${sha256}.jar`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  listPacks() {
    return this.db.prepare('SELECT * FROM packs').all();
  }

  private generatePackId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
}
