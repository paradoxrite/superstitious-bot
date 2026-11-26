import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong and latency statistics!'),
    async execute(interaction: ChatInputCommandInteraction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.editReply(`Pong! 🏓\nRoundtrip Latency: **${latency}ms**\nAPI Latency: **${apiLatency}ms**`);
    },
};