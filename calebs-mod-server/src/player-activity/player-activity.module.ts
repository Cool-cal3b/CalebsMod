import { Module } from '@nestjs/common';
import { PlayerActivityController } from './player-activity.controller';
import { PlayerActivityService } from './player-activity.service';

@Module({
  controllers: [PlayerActivityController],
  providers: [PlayerActivityService],
  exports: [PlayerActivityService],
})
export class PlayerActivityModule {}
