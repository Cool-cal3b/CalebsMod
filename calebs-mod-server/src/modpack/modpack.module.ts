import { Module } from '@nestjs/common';
import { ModpackController } from './modpack.controller';
import { ModpackService } from './modpack.service';

@Module({
  controllers: [ModpackController],
  providers: [ModpackService],
  exports: [ModpackService],
})
export class ModpackModule {}
