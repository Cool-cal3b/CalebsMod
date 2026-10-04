import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorldService } from './world.service';

const upload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.resolve(
        process.env.WORLD_STORAGE_PATH || './storage',
        'world-uploads',
      );
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.zip`),
  }),
  limits: { fileSize: 50 * 1024 ** 3, files: 1 },
});

@Controller('api/worlds')
export class WorldController {
  constructor(private worlds: WorldService) {}
  @Get('active') active() {
    return this.worlds.activeInfo();
  }
  @Get(':id/pack') pack(
    @Param('id') id: string,
    @Query('revision') revision: string,
  ) {
    const { world, maintenance } = this.worlds.activeInfo();
    if (maintenance)
      throw new ConflictException('World maintenance is in progress');
    if (!world || world.id !== id || Number(revision) !== world.revision)
      throw new ConflictException(
        'The active world or pack changed; retry sync',
      );
    const files = this.worlds.store
      .manifest(id, world.revision)
      .filter((f) => !f.serverOnly)
      .map(({ serverSha256, ...file }) => file);
    return {
      worldId: id,
      generation: world.generation,
      revision: world.revision,
      files,
    };
  }
  @Get() @UseGuards(JwtAuthGuard) list() {
    return this.worlds.list();
  }
  @Get('operations/:id') @UseGuards(JwtAuthGuard) operation(
    @Param('id') id: string,
  ) {
    return this.worlds.store.operation(id);
  }
  @Post('recover') @UseGuards(JwtAuthGuard) recover() {
    return this.worlds.recover();
  }
  @Post('enable-switching') @UseGuards(JwtAuthGuard) enable() {
    return this.worlds.enableSwitching();
  }
  @Post('adopt') @UseGuards(JwtAuthGuard) adopt() {
    return this.worlds.adopt();
  }
  @Post() @UseGuards(JwtAuthGuard) create(
    @Body()
    body: {
      name: string;
      sourceId?: string;
      copy?: boolean;
      seed?: string;
    },
  ) {
    return this.worlds.create(body);
  }
  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(upload)
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
  ) {
    if (!file) throw new BadRequestException('A backup ZIP is required');
    try {
      return this.worlds.importBackup(file.path, name);
    } catch (error) {
      fs.unlinkSync(file.path);
      throw error;
    }
  }
  @Get('backups/:id/download')
  @UseGuards(JwtAuthGuard)
  download(@Param('id') id: string, @Res() res: Response) {
    const record = this.worlds.backupRecord(id);
    if (record.kind === 'migration')
      throw new BadRequestException(
        'The private migration archive is retained on the server; create a portable manual backup to download',
      );
    res.setHeader('X-Checksum-Sha256', record.sha256);
    res.download(record.file_path, `world-${record.world_id}-${id}.zip`);
  }
  @Post('backups/:id/restore')
  @UseGuards(JwtAuthGuard)
  restore(@Param('id') id: string, @Body('name') name: string) {
    return this.worlds.restore(id, name);
  }
  @Get(':id') @UseGuards(JwtAuthGuard) detail(@Param('id') id: string) {
    return this.worlds.detail(id);
  }
  @Patch(':id') @UseGuards(JwtAuthGuard) edit(
    @Param('id') id: string,
    @Body() body: { name?: string; archived?: boolean },
  ) {
    return this.worlds.edit(id, body);
  }
  @Post(':id/switch') @UseGuards(JwtAuthGuard) switch(@Param('id') id: string) {
    return this.worlds.switchWorld(id);
  }
  @Post(':id/backup') @UseGuards(JwtAuthGuard) backup(@Param('id') id: string) {
    return this.worlds.backup(id);
  }
  @Patch(':id/settings') @UseGuards(JwtAuthGuard) settings(
    @Param('id') id: string,
    @Body('settings') settings: Record<string, string>,
  ) {
    return this.worlds.updateSettings(id, settings);
  }
  @Patch(':id/draft') @UseGuards(JwtAuthGuard) draft(
    @Param('id') id: string,
    @Body()
    body: {
      relativePath?: string;
      remove?: boolean;
      serverOnly?: boolean;
      clientOnly?: boolean;
      discard?: boolean;
    },
  ) {
    return this.worlds.editDraft(id, body);
  }
  @Post(':id/draft/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(upload)
  upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A modpack ZIP is required');
    return this.worlds.uploadDraft(id, file.path).finally(() => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }
  @Get(':id/changes') @UseGuards(JwtAuthGuard) changes(
    @Param('id') id: string,
  ) {
    return this.worlds.changes(id);
  }
  @Post(':id/apply') @UseGuards(JwtAuthGuard) apply(@Param('id') id: string) {
    return this.worlds.apply(id);
  }
}
