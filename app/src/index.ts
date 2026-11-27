import dotenv from 'dotenv';
dotenv.config();

import { ExtendedClient } from './structure/ExtendedClient';
import { loadCommands, loadEvents } from './utils/handler';
import clientManager from './client/ClientManager';

import { OAuthDatabase } from "./structure/OAuthDatabase";
import { startOAuthServer } from "./utils/OAuthServer";

const oauthDb = new OAuthDatabase(process.env.SQLITE_DB_PATH ?? "/bot/data/oauth.db");

const oauthServer = startOAuthServer({
  port: Number(process.env.OAUTH_PORT ?? 3000),
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: process.env.DISCORD_REDIRECT_URI!,
  db: oauthDb,
});

process.on("SIGTERM", () => {
  oauthServer.close();
  oauthDb.close();
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error('[Fatal Error] DISCORD_TOKEN is missing from your environment variables or .env file!');
    process.exit(1);
}

const client = new ExtendedClient();

// Initialize subsystems, commands, and events
clientManager(client);
loadCommands(client);
loadEvents(client);

// Log in to Discord securely
client.login(token);