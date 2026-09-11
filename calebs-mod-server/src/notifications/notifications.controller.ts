import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import type { DeviceStatus } from './notifications.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  @Post('devices/register')
  register(@Body() body: { username?: string; deviceName?: string }) {
    try {
      return this.notifications.register(
        body.username ?? '',
        body.deviceName ?? '',
      );
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('admin/devices')
  @UseGuards(JwtAuthGuard)
  listDevices(@Query('status') status?: DeviceStatus) {
    return this.notifications.listDevices(status);
  }

  @Post('admin/devices/:id/approve')
  @UseGuards(JwtAuthGuard)
  approve(@Param('id') id: string) {
    try {
      const device = this.notifications.approve(id);
      this.gateway.deviceChanged(id);
      return device;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.NOT_FOUND);
    }
  }

  @Post('admin/devices/:id/revoke')
  @UseGuards(JwtAuthGuard)
  revoke(@Param('id') id: string) {
    try {
      const device = this.notifications.revoke(id);
      this.gateway.deviceChanged(id);
      return device;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.NOT_FOUND);
    }
  }
}
