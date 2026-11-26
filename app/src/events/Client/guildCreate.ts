import { Guild } from 'discord.js';

export default {
    name: 'guildCreate',
    async execute(guild: Guild) {
        console.log(`[GuildCreate] Joined new server: ${guild.name} (${guild.id})`);
    },
};