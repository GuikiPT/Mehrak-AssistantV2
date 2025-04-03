const Discord = require('discord.js');
const { LeonShrineEventConfig } = require('../../../../database/models/LeonShrineEvent');

/**
 * Execute the deactivate subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function execute(interaction, guildId) {
    try {
        const config = await LeonShrineEventConfig.findOrCreateConfig(guildId);
        
        if (!config.active) {
            return await interaction.reply({
                content: 'ℹ️ The Leon Shrine event is already deactivated.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        await config.update({ active: false });
        
        const deactivateEmbed = new Discord.EmbedBuilder()
            .setTitle('Leon Shrine Event Deactivated')
            .setDescription('✅ The event has been deactivated.')
            .setColor(0xFFA500)
            .setTimestamp()
            .setFooter({ text: 'Use /leon-shrine activate to start the event again' });
        
        await interaction.reply({
            embeds: [deactivateEmbed],
            flags: [Discord.MessageFlags.Ephemeral],
        });
        
    } catch (err) {
        console.error('Error executing deactivate command:', err);
        throw err;
    }
}

module.exports = { execute };
