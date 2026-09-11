import { Injectable } from '@nestjs/common';

export interface MojangProfile {
  /** Dashed, which is how the server log writes UUIDs. */
  id: string;
  name: string;
}

const HAS_JOINED_URL =
  'https://sessionserver.mojang.com/session/minecraft/hasJoined';
const TIMEOUT_MS = 10000;

/**
 * Proves a client owns the Minecraft account it claims, using the same check
 * an online-mode Minecraft server makes when a player connects. The client
 * tells Mojang it is joining `serverId` using its own access token, which only
 * the account's owner holds; we then ask Mojang whether that happened. The
 * token itself never reaches this server.
 */
@Injectable()
export class MojangSessionService {
  async hasJoined(
    username: string,
    serverId: string,
  ): Promise<MojangProfile | null> {
    const url = new URL(HAS_JOINED_URL);
    url.searchParams.set('username', username);
    url.searchParams.set('serverId', serverId);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 204 is Mojang saying no such join happened, not a failure.
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Mojang session server returned ${response.status}`);
    }

    const body = (await response.json()) as { id?: unknown; name?: unknown };
    if (
      typeof body.id !== 'string' ||
      !/^[0-9a-f]{32}$/i.test(body.id) ||
      typeof body.name !== 'string'
    ) {
      return null;
    }

    const id = body.id.toLowerCase();
    return {
      id: `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`,
      name: body.name,
    };
  }
}
