import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { DockerModule } from '../docker/docker.module';
import { RconModule } from '../rcon/rcon.module';
import { AuthModule } from '../auth/auth.module';
import { WorldStore } from './world-store';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';
import { WorldSafetyInterceptor } from './world-safety.interceptor';

@Global()
@Module({
  imports: [DatabaseModule, DockerModule, RconModule, AuthModule],
  providers: [
    WorldStore,
    WorldService,
    { provide: APP_INTERCEPTOR, useClass: WorldSafetyInterceptor },
  ],
  controllers: [WorldController],
  exports: [WorldStore, WorldService],
})
export class WorldModule {}
