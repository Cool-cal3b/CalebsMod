import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Res,
  Req,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ModpackService, SHA256_PATTERN, MAX_BATCH_FILES } from './modpack.service';
import { AddModDto, CreatePackDto, UpdatePackDto } from './dto/pack.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';

@Controller('api/modpack')
export class ModpackController {
  constructor(private readonly modpackService: ModpackService) {}

  @Get('manifest')
  getManifest() {
    return this.modpackService.getManifest();
  }

  @Get('files/:sha256')
  downloadFile(@Param('sha256') sha256: string, @Res() res: Response) {
    const filePath = this.modpackService.getPackFile(sha256);
    if (!filePath) {
      throw new NotFoundException('File not found');
    }
    res.download(filePath);
  }

  @Post('upload-zip')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './storage/cache',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadModpackZip(@UploadedFile() file: Express.Multer.File) {
    try {
      console.log('Uploading modpack zip...');
      const result = await this.modpackService.uploadModpackZip(file.path);
      return result;
    } finally {
      if (file.path) {
        const fs = require('fs');
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
  }

  @Delete('files/:sha256')
  @UseGuards(JwtAuthGuard)
  removeFile(@Param('sha256') sha256: string) {
    this.modpackService.removeFile(sha256);
    return { success: true };
  }

  @Get('sync/:fromRevision')
  async syncFromRevision(@Param('fromRevision') fromRevision: string, @Res() res: Response) {
    const fromRevisionId = parseInt(fromRevision, 10);
    const syncData = await this.modpackService.getSyncData(fromRevisionId);

    if (syncData.upToDate) {
      return res.json({ upToDate: true, latestRevision: syncData.latestRevision });
    }

    return res.json({
      upToDate: false,
      latestRevision: syncData.latestRevision,
      filesToAdd: syncData.filesToAdd,
      filesToRemove: syncData.filesToRemove,

      // give client a URL to fetch the zip
      zipUrl: `/api/modpack/sync-zip/${fromRevisionId}`,
    });
  }

  @Post('batch-zip')
  async batchZip(@Body() body: { sha256s?: string[] }, @Res() res: Response) {
    const sha256s = Array.isArray(body?.sha256s) ? body.sha256s : null;

    if (!sha256s || sha256s.length === 0) {
      throw new BadRequestException('sha256s must be a non-empty array');
    }

    // Bounds the zip the server builds in memory, and keeps the request body
    // under the default JSON limit.
    if (sha256s.length > MAX_BATCH_FILES) {
      throw new BadRequestException(
        `batch too large: ${sha256s.length} (max ${MAX_BATCH_FILES})`,
      );
    }

    for (const sha256 of sha256s) {
      if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) {
        throw new BadRequestException(`invalid sha256: ${String(sha256)}`);
      }
    }

    const zipBuffer = await this.modpackService.createBatchZip(sha256s);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Length': String(zipBuffer.length),
    });

    return res.status(200).send(zipBuffer);
  }

  @Get('sync-zip/:fromRevision')
  async syncZip(@Param('fromRevision') fromRevision: string, @Res() res: Response) {
    const fromRevisionId = parseInt(fromRevision, 10);
    const syncData = await this.modpackService.getSyncData(fromRevisionId);

    if (syncData.upToDate) return res.status(204).end();

    const zipBuffer = await this.modpackService.createSyncZip(syncData.filesToAdd);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="calebsmod-sync-${fromRevisionId}-to-${syncData.latestRevision}.zip"`,
      'X-Latest-Revision': String(syncData.latestRevision),
      'X-Files-To-Remove': JSON.stringify(syncData.filesToRemove),
      'Content-Length': String(zipBuffer.length),
    });

    console.log(`zipBuffer: ${zipBuffer.length}`);
    return res.status(200).send(zipBuffer); // sends bytes, no base64
  }

  @Get('latest-revision')
  getLatestRevision() {
    return {
      latestRevision: this.modpackService.getLatestRevision(),
    };
  }

  @Get('revision-tracking')
  @UseGuards(JwtAuthGuard)
  getRevisionTrackingStatus() {
    return this.modpackService.getRevisionTrackingStatus();
  }

  @Post('revision-tracking')
  @UseGuards(JwtAuthGuard)
  setRevisionTrackingStatus(
    @Body() body: { paused: boolean; resetHistory?: boolean },
    @Req() req: { user?: { username?: string } },
  ) {
    if (typeof body?.paused !== 'boolean') {
      throw new BadRequestException('paused must be a boolean');
    }
    if (body.resetHistory !== undefined && typeof body.resetHistory !== 'boolean') {
      throw new BadRequestException('resetHistory must be a boolean');
    }
    return this.modpackService.setRevisionTrackingPaused(
      body.paused,
      req.user?.username,
      body.resetHistory ?? false,
    );
  }

  @Delete('files')
  @UseGuards(JwtAuthGuard)
  deleteAllFiles() {
    return this.modpackService.deleteAllFiles();
  }

  @Get('files')
  @UseGuards(JwtAuthGuard)
  getAllFiles(@Query('search') search?: string) {
    return this.modpackService.getAllFiles(search);
  }

  @Patch('files/:sha256')
  @UseGuards(JwtAuthGuard)
  updateFileFlags(
    @Param('sha256') sha256: string,
    @Body() body: { serverOnly: boolean; clientOnly: boolean },
  ) {
    this.modpackService.updateFileFlags(sha256, body.serverOnly, body.clientOnly);
    return { success: true };
  }

  @Post('resync')
  @UseGuards(JwtAuthGuard)
  createFullResync() {
    return this.modpackService.createFullResyncRevision();
  }
}
