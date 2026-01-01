import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dbPath =
      this.configService.get<string>('DB_PATH') || './data/calebs-mod.db';
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS packs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        minecraft_version TEXT NOT NULL,
        loader_type TEXT NOT NULL,
        loader_version TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pack_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id TEXT NOT NULL,
        version TEXT NOT NULL,
        changelog TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE,
        UNIQUE(pack_id, version)
      );

      CREATE TABLE IF NOT EXISTS mods (
        sha256 TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        original_url TEXT,
        mod_id TEXT,
        mod_version TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pack_version_mods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_version_id INTEGER NOT NULL,
        mod_sha256 TEXT NOT NULL,
        required BOOLEAN DEFAULT 1,
        FOREIGN KEY (pack_version_id) REFERENCES pack_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (mod_sha256) REFERENCES mods(sha256) ON DELETE CASCADE,
        UNIQUE(pack_version_id, mod_sha256)
      );

      CREATE TABLE IF NOT EXISTS access_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        uuid TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        reviewed_by TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
      CREATE INDEX IF NOT EXISTS idx_access_requests_username ON access_requests(username);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_pack_versions_pack_id ON pack_versions(pack_id);
    `);
  }

  getDb(): Database.Database {
    return this.db;
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  logAudit(
    action: string,
    entityType: string,
    entityId: string,
    user?: string,
    metadata?: any,
  ) {
    const stmt = this.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, user, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      action,
      entityType,
      entityId,
      user || null,
      metadata ? JSON.stringify(metadata) : null,
      Date.now(),
    );
  }
}
