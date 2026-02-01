import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { AuthModule } from '../auth/auth.module';
import { ModpackModule } from '../modpack/modpack.module';

@Module({
  imports: [AuthModule, ModpackModule],
  controllers: [ServerController],
  providers: [ServerService],
  exports: [ServerService],
})
export class ServerModule {}
