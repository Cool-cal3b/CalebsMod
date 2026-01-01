import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private db: DatabaseService,
  ) {}

  async validateAdminSecret(adminSecret: string): Promise<boolean> {
    const expectedSecret = this.configService.get<string>('ADMIN_SECRET');
    return adminSecret === expectedSecret;
  }

  async login(adminSecret: string) {
    const isValid = await this.validateAdminSecret(adminSecret);
    if (!isValid) {
      throw new Error('Invalid admin secret');
    }

    const payload = { role: 'admin', timestamp: Date.now() };
    const token = this.jwtService.sign(payload);

    const expirationMs = this.parseExpiration(
      this.configService.get<string>('JWT_EXPIRATION') || '12h',
    );
    const expiresAt = Date.now() + expirationMs;

    this.db
      .prepare(
        `
      INSERT INTO admin_sessions (token, created_at, expires_at)
      VALUES (?, ?, ?)
    `,
      )
      .run(token, Date.now(), expiresAt);

    this.cleanExpiredSessions();

    return {
      access_token: token,
      expires_at: expiresAt,
    };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const session = this.db
        .prepare(
          `
        SELECT expires_at FROM admin_sessions WHERE token = ?
      `,
        )
        .get(token) as any;

      if (!session) {
        return false;
      }

      if (Date.now() > session.expires_at) {
        this.revokeToken(token);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  revokeToken(token: string) {
    this.db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  }

  cleanExpiredSessions() {
    this.db
      .prepare('DELETE FROM admin_sessions WHERE expires_at < ?')
      .run(Date.now());
  }

  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 12 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 12 * 60 * 60 * 1000;
    }
  }
}
