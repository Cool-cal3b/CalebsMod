import { Module } from '@nestjs/common';
import { ModpackController } from './modpack.controller';
import { ModpackService } from './modpack.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModpackController],
  providers: [ModpackService],
  exports: [ModpackService],
})
export class ModpackModule {}
