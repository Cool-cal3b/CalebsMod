import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RconService } from '../rcon/rcon.service';
import { AccessRequestDto } from './dto/access.dto';

@Injectable()
export class AccessService {
  constructor(
    private db: DatabaseService,
    private rcon: RconService,
  ) {}

  createRequest(dto: AccessRequestDto) {
    const now = Date.now();

    const existingRequest = this.db
      .prepare(
        `
      SELECT id FROM access_requests 
      WHERE username = ? AND status = 'pending'
    `,
      )
      .get(dto.username);

    if (existingRequest) {
      return {
        status: 'duplicate',
        message: 'You already have a pending request',
      };
    }

    const result = this.db
      .prepare(
        `
      INSERT INTO access_requests (username, uuid, status, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?)
    `,
      )
      .run(dto.username, dto.uuid || null, now, now);

    this.db.logAudit(
      'create',
      'access_request',
      result.lastInsertRowid.toString(),
      dto.username,
    );

    return {
      status: 'created',
      message: 'Access request submitted successfully',
      requestId: result.lastInsertRowid,
    };
  }

  async approveRequest(requestId: number, reviewedBy?: string, notes?: string) {
    const request = this.db
      .prepare(
        `
      SELECT * FROM access_requests WHERE id = ?
    `,
      )
      .get(requestId) as any;

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request has already been reviewed');
    }

    try {
      await this.rcon.whitelist(request.username);

      this.db
        .prepare(
          `
        UPDATE access_requests
        SET status = 'approved', reviewed_by = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `,
        )
        .run(reviewedBy || null, notes || null, Date.now(), requestId);

      this.db.logAudit(
        'approve',
        'access_request',
        requestId.toString(),
        reviewedBy,
        { username: request.username },
      );

      return {
        status: 'approved',
        message: `Access granted to ${request.username}`,
      };
    } catch (error) {
      throw new Error(`Failed to whitelist user: ${error.message}`);
    }
  }

  denyRequest(requestId: number, reviewedBy?: string, notes?: string) {
    const request = this.db
      .prepare(
        `
      SELECT * FROM access_requests WHERE id = ?
    `,
      )
      .get(requestId) as any;

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request has already been reviewed');
    }

    this.db
      .prepare(
        `
      UPDATE access_requests
      SET status = 'denied', reviewed_by = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(reviewedBy || null, notes || null, Date.now(), requestId);

    this.db.logAudit(
      'deny',
      'access_request',
      requestId.toString(),
      reviewedBy,
      { username: request.username },
    );

    return {
      status: 'denied',
      message: `Access denied for ${request.username}`,
    };
  }

  listRequests(status?: string) {
    let query = 'SELECT * FROM access_requests';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.prepare(query).all(...params);
  }

  getRequest(requestId: number) {
    return this.db
      .prepare(
        `
      SELECT * FROM access_requests WHERE id = ?
    `,
      )
      .get(requestId);
  }

  async revokeAccess(username: string, revokedBy?: string) {
    try {
      await this.rcon.removeWhitelist(username);

      this.db.logAudit('revoke', 'whitelist', username, revokedBy);

      return {
        status: 'revoked',
        message: `Access revoked for ${username}`,
      };
    } catch (error) {
      throw new Error(`Failed to remove from whitelist: ${error.message}`);
    }
  }
}
