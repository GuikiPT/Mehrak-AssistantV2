/**
 * @module events/reaction-logs/MessageReactionRemove
 */
const Discord = require('discord.js');
const colors = require('colors/safe');
const ServerConfig = require('../../database/models/ServerConfig');

module.exports = {
    name: Discord.Events.MessageReactionRemove,
    once: false,
    /**
     * @async
     * @param {Discord.MessageReaction} reaction
     * @param {Discord.User} user
     */
    async execute(reaction, user) {
        if (user.bot) return;

        try {
            const logChannelId = await getReactionLogChannel(reaction.message.guild);
            if (!logChannelId) return;

            const logChannel = reaction.message.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            let message = reaction.message;
            const emoji = reaction.emoji;

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

            const reactionUser = user.username;
            const reactionUserId = user.id;

            const authorField = `- ${messageAuthor}\n- <@!${messageAuthorId}>\n- ${messageAuthorId}`;
            const reactionUserField = `- ${reactionUser}\n- <@!${reactionUserId}>\n- ${reactionUserId}`;

            let embed = new Discord.EmbedBuilder()
                .setColor('Yellow')
                .setTitle('**Reaction Removed**')
                .setAuthor({ name: reactionUser, iconURL: user.displayAvatarURL() })
                .addFields(
                    { name: '**User Who Sent the Message:**', value: authorField },
                    { name: '**User Who Reacted:**', value: reactionUserField },
                    { name: '**Reaction:**', value: emoji.name, inline: true },
                    { name: '**Message Content:**', value: messageContent },
                    { name: '**Message Link:**', value: `[Jump to message](${message.url})` },
                    { name: '**Channel:**', value: `${message.channel}` },
                    { name: '**Time of Reaction Removal:**', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                )
                .setTimestamp();

            if (emoji.id) {
                const emojiURL = emoji.animated
                    ? `https://cdn.discordapp.com/emojis/${emoji.id}.gif?size=128&quality=lossless`
                    : `https://cdn.discordapp.com/emojis/${emoji.id}.png?size=128&quality=lossless`;
                embed = embed.setThumbnail(emojiURL);
            } else {
                const emojiImageURL = `https://emojicdn.elk.sh/${encodeURIComponent(emoji.name)}`;
                embed = embed.setThumbnail(emojiImageURL);
            }

            if (hasEmbeds) {
                const logMessage = await logChannel.send({ embeds: [embed] });
                
                try {
                    const rebuiltEmbeds = messageEmbeds.map(originalEmbed => {
                        if (originalEmbed.data) {
                            return new Discord.EmbedBuilder(originalEmbed.data);
                        }
                        return originalEmbed;
                    });
                    
                    const thread = await logMessage.startThread({
                        name: `Reaction Remove - ${reactionUser}`,
                        autoArchiveDuration: 60
                    });
                    
                    await thread.send({
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
            console.error(colors.red('Error handling messageReactionRemove event:', error));
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
