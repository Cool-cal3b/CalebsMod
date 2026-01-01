import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ModpackModule } from './modpack/modpack.module';
import { AccessModule } from './access/access.module';
import { ServerModule } from './server/server.module';
import { RconModule } from './rcon/rcon.module';
import { DockerModule } from './docker/docker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    ModpackModule,
    AccessModule,
    ServerModule,
    RconModule,
    DockerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
