import fs from 'fs';
import path from 'path';
import { ExtendedClient } from '../structure/ExtendedClient';

export function loadCommands(client: ExtendedClient) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath).default || require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

export function loadEvents(client: ExtendedClient) {
    const eventsPath = path.join(__dirname, '../events/Client');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath).default || require(filePath);
        if (event.once) {
            client.once(event.name, (...args: any[]) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args: any[]) => event.execute(...args, client));
        }
    }
}