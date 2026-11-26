import { Client, GatewayIntentBits, Collection } from 'discord.js';

export class ExtendedClient extends Client {
    public commands: Collection<string, any>;
    public components: Collection<string, any>;

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
            ],
        });
        this.commands = new Collection();
        this.components = new Collection();
    }
}