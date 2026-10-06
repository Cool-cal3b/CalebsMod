import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { defer, lastValueFrom } from 'rxjs';
import { WorldStore } from './world-store';

@Injectable()
export class WorldSafetyInterceptor implements NestInterceptor {
  constructor(private worlds: WorldStore) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    // Express routes ignore case and a trailing slash; match the same way.
    const url = (req.path as string).toLowerCase().replace(/\/+$/, '');
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      (req.method === 'POST' && url === '/api/modpack/batch-zip') ||
      url.startsWith('/api/worlds')
    )
      return next.handle();
    if (url.startsWith('/api/modpack'))
      throw new ConflictException(
        'Use Admin > Worlds to stage modpack changes for a specific world',
      );
    if (url.startsWith('/api/server') || url.startsWith('/api/access')) {
      this.worlds.assertIdle();
      if (url === '/api/server/command' || url.startsWith('/api/access'))
        return defer(() =>
          this.worlds.exclusive(() => lastValueFrom(next.handle())),
        );
    }
    return next.handle();
  }
}
