import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('devices/register')
  async register(
    @Body()
    body: {
      username?: string;
      serverId?: string;
      deviceName?: string;
      deviceId?: string;
      token?: string;
    },
  ) {
    try {
      return await this.notifications.register({
        username: body.username ?? '',
        serverId: body.serverId ?? '',
        deviceName: body.deviceName ?? '',
        deviceId: body.deviceId,
        token: body.token,
      });
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }
}
