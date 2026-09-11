import { Module } from '@nestjs/common';
import { MojangSessionService } from './mojang-session.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, MojangSessionService],
})
export class NotificationsModule {}
