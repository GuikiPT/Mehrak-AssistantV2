/**
 * @module events/reaction-logs/MessageReactionRemoveAll
 */
const Discord = require('discord.js');
const colors = require('colors/safe');
const ServerConfig = require('../../database/models/ServerConfig');

module.exports = {
    name: Discord.Events.MessageReactionRemoveAll,
    once: false,
    /**
     * @async
     * @param {Discord.Message} message
     */
    async execute(message) {
        try {
            const logChannelId = await getReactionLogChannel(message.guild);
            if (!logChannelId) return;

            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            if (message.partial) {
                try {
                    message = await message.fetch();
                } catch (error) {
                    console.error(colors.red('Error fetching full message:', error));
                    return;
                }
            }

            const messageAuthor = message.author ? message.author.tag : 'Unknown Author';
            const messageAuthorId = message.author ? message.author.id : 'Unknown ID';
            
            const messageEmbeds = message.embeds;
            const hasEmbeds = messageEmbeds && messageEmbeds.length > 0;
            
            let messageContent = message.content;
            if (!messageContent && hasEmbeds) {
                messageContent = `This message contains ${messageEmbeds.length} embed(s) but no text content.`;
            } else if (!messageContent) {
                messageContent = 'No text content';
            }

            if (messageContent.length > 1024) {
                messageContent = messageContent.slice(0, 1015) + '...';
            }

            const authorField = `- ${messageAuthor}\n- <@!${messageAuthorId}>\n- ${messageAuthorId}`;

            let embed = new Discord.EmbedBuilder()
                .setColor('Red')
                .setTitle('**All Reactions Removed from Message**')
                .addFields(
                    { name: '**User Who Sent the Message:**', value: authorField },
                    { name: '**Message Content:**', value: messageContent },
                    { name: '**Message Link:**', value: `[Jump to message](${message.url})` },
                    { name: '**Channel:**', value: `${message.channel}` },
                    { name: '**Time of Removal:**', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                )
                .setTimestamp();

            if (hasEmbeds) {
                const logMessage = await logChannel.send({ embeds: [embed] });
                
                try {
                    const rebuiltEmbeds = messageEmbeds.map(originalEmbed => {
                        if (originalEmbed.data) {
                            return new Discord.EmbedBuilder(originalEmbed.data);
                        }
                        return originalEmbed;
                    });
                    
                    await logMessage.reply({ 
                        content: `## **Original embeds from the message:**`,
                        embeds: rebuiltEmbeds 
                    });
                } catch (embedError) {
                    console.error(colors.red('Error sending original embeds:', embedError));
                    await logChannel.send({ content: 'Failed to send original embeds due to an error.' });
                }
            } else {
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error(colors.red('Error handling messageReactionRemoveAll event:', error));
        }
    },
};

/**
 * @async
 * @param {Discord.Guild} guild
 * @returns {Promise<string|null>}
 */
async function getReactionLogChannel(guild) {
    try {
        const config = await ServerConfig.findOne({
            where: { guild_id: guild.id }
        });
        return config ? config.reaction_log_channels_id : null;
    } catch (error) {
        console.error(colors.red('Error fetching reaction log channel:', error));
        return null;
    }
}
