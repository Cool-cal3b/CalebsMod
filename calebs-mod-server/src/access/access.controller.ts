import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessService } from './access.service';
import { AccessRequestDto, ReviewAccessDto } from './dto/access.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post('request')
  createRequest(@Body() dto: AccessRequestDto) {
    return this.accessService.createRequest(dto);
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  listRequests(@Query('status') status?: string) {
    return this.accessService.listRequests(status);
  }

  @Get('requests/:id')
  @UseGuards(JwtAuthGuard)
  getRequest(@Param('id') id: string) {
    return this.accessService.getRequest(parseInt(id));
  }

  @Post('approve/:id')
  @UseGuards(JwtAuthGuard)
  async approveRequest(@Param('id') id: string, @Body() dto: ReviewAccessDto) {
    return await this.accessService.approveRequest(
      parseInt(id),
      'admin',
      dto.notes,
    );
  }

  @Post('deny/:id')
  @UseGuards(JwtAuthGuard)
  denyRequest(@Param('id') id: string, @Body() dto: ReviewAccessDto) {
    return this.accessService.denyRequest(parseInt(id), 'admin', dto.notes);
  }

  @Post('revoke/:username')
  @UseGuards(JwtAuthGuard)
  async revokeAccess(@Param('username') username: string) {
    return await this.accessService.revokeAccess(username, 'admin');
  }
}
