const Discord = require('discord.js');
const { LeonShrineEventConfig } = require('../../../../database/models/LeonShrineEvent');

/**
 * Execute the activate subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function execute(interaction, guildId) {
    try {
        const config = await LeonShrineEventConfig.findOrCreateConfig(guildId);
        
        if (!config.channel_id) {
            return await interaction.reply({
                content: '⚠️ You need to configure a channel first using `/leon-shrine config` before activating the event.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }

        if (!config.sticker_id) {
            return await interaction.reply({
                content: '⚠️ You need to configure a sticker ID first using `/leon-shrine config` before activating the event.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        if (config.active) {
            return await interaction.reply({
                content: 'ℹ️ The Leon Shrine event is already active.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        await config.update({ active: true });
        
        const activateEmbed = new Discord.EmbedBuilder()
            .setTitle('Leon Shrine Event Activated')
            .setDescription('✅ The event has been successfully activated!')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Channel', value: `<#${config.channel_id}>`, inline: false },
                { name: 'Sticker ID', value: config.sticker_id, inline: false },
                { name: 'Role', value: config.role_id ? `<@&${config.role_id}>` : 'Not set', inline: false }
            )
            .setTimestamp();
            
        try {
            const sticker = await interaction.client.fetchSticker(config.sticker_id).catch(() => null);
            if (sticker) {
                activateEmbed.setThumbnail(sticker.url);
            }
        } catch (error) {
            console.error('Error fetching sticker for activate embed:', error);
        }
        
        await interaction.reply({
            embeds: [activateEmbed],
            flags: [Discord.MessageFlags.Ephemeral],
        });
        
    } catch (err) {
        console.error('Error executing activate command:', err);
        throw err;
    }
}

module.exports = { execute };
