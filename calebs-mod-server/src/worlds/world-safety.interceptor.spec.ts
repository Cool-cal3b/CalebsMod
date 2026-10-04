import { ConflictException, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { WorldSafetyInterceptor } from './world-safety.interceptor';
import { WorldStore } from './world-store';

describe('WorldSafetyInterceptor', () => {
  const context = (method: string, path: string) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
    }) as unknown as ExecutionContext;

  it('allows the read-only POST batch download to reach its world binding checks', () => {
    const interceptor = new WorldSafetyInterceptor({} as WorldStore);
    const response = of(Buffer.from('published pack'));
    const next = { handle: jest.fn(() => response) };
    expect(
      interceptor.intercept(context('POST', '/api/modpack/batch-zip'), next),
    ).toBe(response);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['POST', '/api/modpack/upload'],
    ['POST', '/api/modpack/resync'],
    ['POST', '/api/modpack/revision-tracking'],
    ['PATCH', '/api/modpack/files/hash'],
    ['DELETE', '/api/modpack/files'],
    ['DELETE', '/api/modpack/batch-zip'],
  ])('still blocks legacy mutations: %s %s', (method, path) => {
    const interceptor = new WorldSafetyInterceptor({} as WorldStore);
    const next = { handle: jest.fn(() => of(null)) };
    expect(() => interceptor.intercept(context(method, path), next)).toThrow(
      ConflictException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });
});
