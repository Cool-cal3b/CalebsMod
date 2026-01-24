import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ServerService } from './server.service';
import { SendCommandDto } from './dto/server.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/server')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Get('status')
  async getStatus() {
    return await this.serverService.getStatus();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  async getMetrics() {
    return await this.serverService.getMetrics();
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  async getLogs(@Query('tail') tail?: string) {
    const tailCount = tail ? parseInt(tail) : 100;
    return await this.serverService.getLogs(tailCount);
  }

  @Get('ip-and-port')
  async getIpAndPort() {
    return await this.serverService.getIpAndPort();
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  async startServer() {
    console.log('Starting server');
    return await this.serverService.startServer();
  }

  @Post('stop')
  @UseGuards(JwtAuthGuard)
  async stopServer() {
    return await this.serverService.stopServer();
  }

  @Post('restart')
  @UseGuards(JwtAuthGuard)
  async restartServer() {
    return await this.serverService.restartServer();
  }

  @Post('command')
  @UseGuards(JwtAuthGuard)
  async sendCommand(@Body() dto: SendCommandDto) {
    return await this.serverService.sendCommand(dto.command);
  }
}
