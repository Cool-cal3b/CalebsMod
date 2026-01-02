import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/auth.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto) {
    try {
      return await this.authService.login(dto.adminSecret);
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Invalid admin secret',
        code: 'INVALID_ADMIN_SECRET',
      });
    }
  }
}
