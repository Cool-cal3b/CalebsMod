import { Controller, Get, Query } from '@nestjs/common';
import { PlayerActivityService } from './player-activity.service';

@Controller('api/players')
export class PlayerActivityController {
  constructor(private readonly playerActivityService: PlayerActivityService) {}

  // Public, like the rest of the read-only server endpoints the client polls.
  @Get('recent')
  getRecent(@Query('days') days?: string) {
    return this.playerActivityService.getRecentPlayers(
      days ? parseInt(days, 10) : undefined,
    );
  }
}
