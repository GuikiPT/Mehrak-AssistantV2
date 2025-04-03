const Discord = require('discord.js');
const { LeonShrineEventConfig } = require('../../../../database/models/LeonShrineEvent');

/**
 * Execute the status subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function execute(interaction, guildId) {
    try {
        const config = await LeonShrineEventConfig.findOrCreateConfig(guildId);
        
        const statusEmoji = config.active ? '✅' : '❌';
        const channelStatus = config.channel_id ? `<#${config.channel_id}>` : '⚠️ - Not configured';
        const stickerStatus = config.sticker_id ? config.sticker_id : '⚠️ - Not configured';
        const roleStatus = config.role_id ? `<@&${config.role_id}>` : '⚠️ - Not configured';
        
        const embed = new Discord.EmbedBuilder()
            .setTitle('Leon Shrine Event Status')
            .setColor(config.active ? 0x00FF00 : 0xFF0000)
            .addFields(
                { 
                    name: 'Status',
                    value: `${statusEmoji} ${config.active ? 'Active' : 'Inactive'}`,
                    inline: false
                },
                { 
                    name: 'Channel',
                    value: channelStatus,
                    inline: true
                },
                { 
                    name: 'Sticker ID',
                    value: stickerStatus,
                    inline: true
                },
                { 
                    name: 'Role',
                    value: roleStatus,
                    inline: true
                }
            )
            .setTimestamp();
        
        if (config.sticker_id) {
            try {
                const sticker = await interaction.client.fetchSticker(config.sticker_id).catch(() => null);
                
                if (sticker) {
                    embed.setThumbnail(sticker.url);
                }
            } catch (error) {
                console.error('Error fetching sticker:', error);
            }
        }
        
        if (!config.channel_id || !config.sticker_id) {
            embed.setFooter({ 
                text: 'Configuration incomplete! Use /leon-shrine config to set up the event' 
            });
        } else if (!config.active) {
            embed.setFooter({ 
                text: 'Event is configured but not active. Use /leon-shrine activate to start the event' 
            });
        } else {
            embed.setFooter({ 
                text: 'Event is active and running' 
            });
        }
        
        await interaction.reply({
            embeds: [embed],
            flags: [Discord.MessageFlags.Ephemeral],
        });
        
    } catch (err) {
        console.error('Error executing status command:', err);
        throw err;
    }
}

module.exports = { execute };
