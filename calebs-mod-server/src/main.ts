import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`CalebsMod Server running on http://localhost:${port}`);
  console.log(`API endpoints:`);
  console.log(`  - GET  /api/modpack/manifest/:packId`);
  console.log(`  - GET  /api/modpack/mods/:sha256`);
  console.log(`  - POST /api/auth/admin/login`);
  console.log(`  - POST /api/access/request`);
  console.log(`  - GET  /api/server/status`);
}
bootstrap();
