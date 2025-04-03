const Discord = require('discord.js');

/**
 * Execute the check-sticker-id subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @returns {Promise<void>}
 */
async function execute(interaction) {
    try {
        await interaction.reply({
            content: 'Please send a message with the sticker you want to check in this channel. I\'ll wait for 60 seconds.',
            flags: [Discord.MessageFlags.Ephemeral]
        });
        
        const message = await interaction.fetchReply();

        const filter = m => m.author.id === interaction.user.id && m.stickers.size > 0;
        
        const collector = interaction.channel.createMessageCollector({ 
            filter, 
            max: 1, 
            time: 60000
        });

        collector.on('collect', async (collectedMessage) => {
            const sticker = collectedMessage.stickers.first();
            
            const embed = new Discord.EmbedBuilder()
                .setTitle('Sticker Information')
                .setColor(0x3498db)
                .addFields(
                    { name: 'Sticker Name', value: sticker.name, inline: true },
                    { name: 'Sticker ID', value: sticker.id, inline: true },
                    { name: 'Format Type', value: sticker.format.toString(), inline: true }
                )
                .setImage(sticker.url)
                .setFooter({ text: 'Use this ID in the /leon-shrine config command' })
                .setTimestamp();
            
            await interaction.followUp({
                content: `Here's the information for the sticker you sent:`,
                embeds: [embed],
                flags: [Discord.MessageFlags.Ephemeral]
            });
            
            try {
                if (collectedMessage.deletable) {
                    await collectedMessage.delete();
                }
            } catch (error) {
                console.error('Could not delete sticker message:', error);
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.followUp({
                    content: 'No sticker received within the time limit. Please try the command again.',
                    flags: [Discord.MessageFlags.Ephemeral]
                });
            }
        });
        
    } catch (err) {
        console.error('Error executing check-sticker-id command:', err);
        throw err;
    }
}

module.exports = { execute };
