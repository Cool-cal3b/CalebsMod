import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const isDevMode = process.env.CALEBS_MOD_ENV === 'dev';
  const defaultPort = isDevMode ? 3001 : 3000;
  const port = process.env.PORT ?? defaultPort;
  
  await app.listen(port);

  console.log(`CalebsMod Server running on http://localhost:${port}`);
  if (isDevMode) {
    console.log(`[DEV MODE] Running on development port ${port}`);
  }
  console.log(`API endpoints:`);
  console.log(`  - GET  /api/modpack/manifest/:packId`);
  console.log(`  - GET  /api/modpack/mods/:sha256`);
  console.log(`  - POST /api/auth/admin/login`);
  console.log(`  - POST /api/access/request`);
  console.log(`  - GET  /api/server/status`);
}
bootstrap();
