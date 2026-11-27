import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export interface StoredOAuthUser {
  discordUserId: string;
  username: string;
  globalName: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  updatedAt: number;
}

interface DiscordRefreshTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

export class OAuthDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS oauth_users (
        discord_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        global_name TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  public upsertUserToken(entry: StoredOAuthUser): void {
    const stmt = this.db.prepare(`
      INSERT INTO oauth_users (
        discord_user_id,
        username,
        global_name,
        access_token,
        refresh_token,
        expires_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_user_id) DO UPDATE SET
        username = excluded.username,
        global_name = excluded.global_name,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      entry.discordUserId,
      entry.username,
      entry.globalName,
      entry.accessToken,
      entry.refreshToken,
      entry.expiresAt,
      entry.updatedAt
    );
  }

  public getUserByDiscordId(discordUserId: string): StoredOAuthUser | undefined {
    const row = this.db
      .prepare(
        `
        SELECT
          discord_user_id AS discordUserId,
          username,
          global_name AS globalName,
          access_token AS accessToken,
          refresh_token AS refreshToken,
          expires_at AS expiresAt,
          updated_at AS updatedAt
        FROM oauth_users
        WHERE discord_user_id = ?
      `
      )
      .get(discordUserId) as StoredOAuthUser | undefined;

    return row;
  }

  public async getValidAccessToken(
    discordUserId: string,
    clientId: string,
    clientSecret: string
  ): Promise<string | null> {
    const record = this.getUserByDiscordId(discordUserId);
    if (!record) {
      return null;
    }

    const bufferMs = 60 * 1000;
    if (Date.now() < record.expiresAt - bufferMs) {
      return record.accessToken;
    }

    if (!record.refreshToken) {
      return null;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: record.refreshToken,
    });

    const res = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Failed to refresh Discord OAuth token:", res.status, errorBody);
      return null;
    }

    const refreshed = (await res.json()) as DiscordRefreshTokenResponse;
    const now = Date.now();
    const nextRefreshToken = refreshed.refresh_token ?? record.refreshToken;

    this.upsertUserToken({
      discordUserId: record.discordUserId,
      username: record.username,
      globalName: record.globalName,
      accessToken: refreshed.access_token,
      refreshToken: nextRefreshToken,
      expiresAt: now + refreshed.expires_in * 1000,
      updatedAt: now,
    });

    return refreshed.access_token;
  }

  public close(): void {
    this.db.close();
  }
}