import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ModpackService } from './modpack.service';
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
}
