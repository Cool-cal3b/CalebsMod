import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ServerService } from './server.service';
import { SendCommandDto, UpdateServerSettingsDto } from './dto/server.dto';
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

  // `platform` is absent for every bootstrapper released before macOS support
  // and resolves to Windows, which is what those clients have always been
  // served.
  @Get('latest-client-version')
  async getLatestClientVersion(@Query('platform') platform?: string) {
    return await this.serverService.getLatestClientVersion(platform);
  }

  @Get('latest-client-release')
  async getLatestClientRelease(@Query('platform') platform?: string) {
    return await this.serverService.getLatestClientRelease(platform);
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

  @Post('update-dns')
  @UseGuards(JwtAuthGuard)
  async updateDns() {
    return await this.serverService.updateDns();
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSettings() {
    return await this.serverService.getSettings();
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Body() dto: UpdateServerSettingsDto) {
    return await this.serverService.updateSettings(dto.settings);
  }
}
