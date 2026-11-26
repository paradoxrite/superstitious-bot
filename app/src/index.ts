import dotenv from 'dotenv';
dotenv.config();

import { ExtendedClient } from './structure/ExtendedClient';
import { loadCommands, loadEvents } from './utils/handler';
import clientManager from './client/ClientManager';

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