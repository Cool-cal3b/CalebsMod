import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * World validation throws plain Errors whose messages are meant for the admin
 * ("Unarchive this world first"). Nest would hide them behind a generic 500,
 * so report them as 400s. System errors (they carry an errno code) stay 500s.
 */
@Catch()
export class WorldErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (error instanceof HttpException) {
      const body = error.getResponse();
      res
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as NodeJS.ErrnoException)?.code ? 500 : 400;
    if (status === 500) console.error('World request failed', error);
    res.status(status).json({ statusCode: status, message });
  }
}
