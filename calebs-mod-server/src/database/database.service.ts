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
      CREATE TABLE IF NOT EXISTS files (
        sha256 TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'mod',
        relative_path TEXT NOT NULL,
        original_url TEXT,
        mod_id TEXT,
        mod_version TEXT,
        required BOOLEAN DEFAULT 1,
        server_only BOOLEAN DEFAULT 0,
        client_only BOOLEAN DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        user TEXT
      );

      CREATE TABLE IF NOT EXISTS revision_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        revision_id INTEGER NOT NULL,
        file_sha256 TEXT NOT NULL,
        action TEXT NOT NULL,
        FOREIGN KEY (revision_id) REFERENCES revisions(id)
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
      CREATE INDEX IF NOT EXISTS idx_revision_files_revision_id ON revision_files(revision_id);
      CREATE INDEX IF NOT EXISTS idx_revision_files_file_sha256 ON revision_files(file_sha256);
    `);

    this.migrateExistingData();
  }

  private migrateExistingData() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const hasFilesTable = tables.some(t => t.name === 'files');
    const hasModsTable = tables.some(t => t.name === 'mods');

    if (!hasFilesTable && hasModsTable) {
      this.db.exec(`
        CREATE TABLE files AS SELECT * FROM mods;
        DROP TABLE IF EXISTS pack_version_mods;
        DROP TABLE IF EXISTS pack_versions;
        DROP TABLE IF EXISTS packs;
        DROP TABLE IF EXISTS mods;
      `);
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  prepare(sql: string): Database.Statement {
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
