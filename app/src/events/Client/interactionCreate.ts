import { Interaction } from 'discord.js';
import { ExtendedClient } from '../../structure/ExtendedClient';

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        const client = interaction.client as ExtendedClient;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
            }
        }
    },
};