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
import * as path from 'path';

@Controller('api/modpack')
export class ModpackController {
  constructor(private readonly modpackService: ModpackService) {}

  @Get('manifest/:packId')
  getManifest(@Param('packId') packId: string) {
    const manifest = this.modpackService.getManifest(packId);
    if (!manifest) {
      throw new NotFoundException('Pack not found');
    }
    return manifest;
  }

  @Get('mods/:sha256')
  downloadMod(@Param('sha256') sha256: string, @Res() res: Response) {
    const filePath = this.modpackService.getModFile(sha256);
    if (!filePath) {
      throw new NotFoundException('Mod file not found');
    }
    res.download(filePath);
  }

  @Get('packs')
  listPacks() {
    return this.modpackService.listPacks();
  }

  @Post('packs')
  @UseGuards(JwtAuthGuard)
  createPack(@Body() dto: CreatePackDto) {
    return this.modpackService.createPack(dto);
  }

  @Post('packs/:packId')
  @UseGuards(JwtAuthGuard)
  updatePack(@Param('packId') packId: string, @Body() dto: UpdatePackDto) {
    this.modpackService.updatePack(packId, dto);
    return { success: true };
  }

  @Post('packs/:packId/mods')
  @UseGuards(JwtAuthGuard)
  async addModByUrl(@Param('packId') packId: string, @Body() dto: AddModDto) {
    if (!dto.url) {
      throw new Error('URL is required');
    }
    return await this.modpackService.addModByUrl(
      packId,
      dto.url,
      dto.modId,
      dto.modVersion,
      dto.required,
    );
  }

  @Post('packs/:packId/mods/upload')
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
  async uploadMod(
    @Param('packId') packId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddModDto,
  ) {
    const result = await this.modpackService.addModByFile(
      packId,
      file.path,
      file.originalname,
      undefined,
      dto.modId,
      dto.modVersion,
      dto.required,
    );
    return result;
  }

  @Delete('packs/:packId/mods/:sha256')
  @UseGuards(JwtAuthGuard)
  removeMod(@Param('packId') packId: string, @Param('sha256') sha256: string) {
    this.modpackService.removeMod(packId, sha256);
    return { success: true };
  }
}
