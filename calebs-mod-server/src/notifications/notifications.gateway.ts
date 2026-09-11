import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';
import type { Server as WebSocketServer } from 'ws';
import {
  NotificationDevice,
  NotificationEvent,
  NotificationsService,
} from './notifications.service';

interface ClientMessage {
  type: string;
  requestId?: string;
  data?: Record<string, unknown>;
}

interface Session {
  device: NotificationDevice;
}

@WebSocketGateway({ path: '/api/notifications/socket' })
export class NotificationsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly authTimers = new Map<WebSocket, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly notifications: NotificationsService) {}

  afterInit(server: WebSocketServer) {
    this.heartbeat = setInterval(() => {
      for (const client of server.clients) {
        if (client.readyState === WebSocket.OPEN) client.ping();
      }
    }, 30000);
  }

  onModuleDestroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  handleConnection(client: WebSocket) {
    const timer = setTimeout(
      () => client.close(4001, 'Authentication required'),
      5000,
    );
    this.authTimers.set(client, timer);
    client.on('message', (raw) => {
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw).toString('utf8')
          : Array.isArray(raw)
            ? Buffer.concat(raw).toString('utf8')
            : Buffer.from(raw as Uint8Array).toString('utf8');
      this.handleMessage(client, text);
    });
    client.on('error', () => this.removeClient(client));
  }

  handleDisconnect(client: WebSocket) {
    this.removeClient(client);
    this.broadcastRecipients();
  }

  private handleMessage(client: WebSocket, raw: string) {
    let message: ClientMessage;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof (parsed as { type?: unknown }).type !== 'string'
      ) {
        throw new Error('invalid envelope');
      }
      message = parsed as ClientMessage;
    } catch {
      this.sendError(client, undefined, 'Malformed message');
      return;
    }

    if (message.type === 'auth') {
      this.authenticate(client, message);
      return;
    }

    const session = this.sessions.get(client);
    if (!session) {
      this.sendError(client, message.requestId, 'Authentication required');
      return;
    }

    try {
      switch (message.type) {
        case 'ping.send': {
          const event = this.notifications.createPing(
            session.device,
            this.stringField(message.data, 'recipientUsername'),
          );
          const deliveredNow = this.deliverEvent(event);
          this.send(
            client,
            'ping.result',
            { event, deliveredNow },
            message.requestId,
          );
          break;
        }
        case 'notification.ack':
          this.notifications.acknowledge(
            this.stringField(message.data, 'eventId'),
            session.device,
          );
          this.send(client, 'ack.result', { ok: true }, message.requestId);
          break;
        case 'settings.update':
          this.notifications.updateCapabilities(
            session.device.id,
            Boolean(message.data?.acceptsDirectPings),
          );
          session.device = this.notifications.getDevice(session.device.id)!;
          this.send(client, 'settings.result', { ok: true }, message.requestId);
          if (session.device.acceptsDirectPings) {
            this.deliverPending(client, session.device);
          }
          this.broadcastRecipients();
          break;
        case 'recipients.get':
          this.sendRecipients(client, session.device, message.requestId);
          break;
        default:
          this.sendError(client, message.requestId, 'Unknown message type');
      }
    } catch (error) {
      const typed = error as Error & { retryAfterMs?: number };
      this.sendError(
        client,
        message.requestId,
        typed.message,
        typed.retryAfterMs,
      );
    }
  }

  private authenticate(client: WebSocket, message: ClientMessage) {
    const device = this.notifications.authenticate(
      this.stringField(message.data, 'deviceId'),
      this.stringField(message.data, 'token'),
    );
    if (!device) {
      this.sendError(client, message.requestId, 'Invalid device credentials');
      // The agent treats this close code as "register again".
      client.close(4002, 'Invalid credentials');
      return;
    }

    const timer = this.authTimers.get(client);
    if (timer) clearTimeout(timer);
    this.authTimers.delete(client);
    this.sessions.set(client, { device });
    this.notifications.markConnected(device.id);
    this.send(client, 'auth.result', { device }, message.requestId);
    if (device.acceptsDirectPings) this.deliverPending(client, device);
    this.broadcastRecipients();
  }

  private deliverEvent(event: NotificationEvent): boolean {
    let delivered = false;
    for (const [client, session] of this.sessions) {
      if (
        session.device.acceptsDirectPings &&
        session.device.username.toLowerCase() ===
          event.recipientUsername.toLowerCase()
      ) {
        this.send(client, 'notification', { event });
        delivered = true;
      }
    }
    return delivered;
  }

  private deliverPending(client: WebSocket, device: NotificationDevice) {
    for (const event of this.notifications.pendingFor(device.username)) {
      this.send(client, 'notification', { event });
    }
  }

  private sendRecipients(
    client: WebSocket,
    device: NotificationDevice,
    requestId?: string,
  ) {
    const connected = this.connectedUsernames();
    const recipients = this.notifications
      .listRecipients(device.username)
      .map((recipient) => ({
        ...recipient,
        connected: connected.has(recipient.username.toLowerCase()),
      }));
    this.send(client, 'recipients.snapshot', { recipients }, requestId);
  }

  private broadcastRecipients() {
    for (const [client, session] of this.sessions) {
      this.sendRecipients(client, session.device);
    }
  }

  private connectedUsernames() {
    const usernames = new Set<string>();
    for (const session of this.sessions.values()) {
      if (session.device.acceptsDirectPings) {
        usernames.add(session.device.username.toLowerCase());
      }
    }
    return usernames;
  }

  private removeClient(client: WebSocket) {
    const timer = this.authTimers.get(client);
    if (timer) clearTimeout(timer);
    this.authTimers.delete(client);
    this.sessions.delete(client);
  }

  private send(
    client: WebSocket,
    type: string,
    data: Record<string, any>,
    requestId?: string,
  ) {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify({ version: 1, type, requestId, data }));
  }

  private sendError(
    client: WebSocket,
    requestId: string | undefined,
    message: string,
    retryAfterMs?: number,
  ) {
    this.send(client, 'error', { message, retryAfterMs }, requestId);
  }

  private stringField(data: Record<string, unknown> | undefined, key: string) {
    const value = data?.[key];
    return typeof value === 'string' ? value : '';
  }
}
