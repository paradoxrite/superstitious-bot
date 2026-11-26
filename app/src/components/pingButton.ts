import { ButtonInteraction } from 'discord.js';

export default {
    customId: 'ping_action_button',
    async execute(interaction: ButtonInteraction) {
        await interaction.reply({ content: 'You successfully triggered the component handler!', ephemeral: true });
    }
};