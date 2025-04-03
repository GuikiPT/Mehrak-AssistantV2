const Discord = require('discord.js');
const { LeonShrineEventConfig } = require('../../../../database/models/LeonShrineEvent');

/**
 * Execute the config subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function execute(interaction, guildId) {
    try {
        const channel = interaction.options.getChannel('channel');
        const stickerId = interaction.options.getString('sticker-id');
        const role = interaction.options.getRole('role');
        
        const permissions = channel.permissionsFor(interaction.client.user);
        if (!permissions.has(Discord.PermissionFlagsBits.SendMessages) || 
            !permissions.has(Discord.PermissionFlagsBits.ViewChannel)) {
            return await interaction.reply({
                content: '❌ I don\'t have permission to send messages in that channel. Please choose a channel where I have proper permissions.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        if (role) {
            const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
            if (role.position >= botMember.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ I cannot assign the specified role because it is positioned higher than or equal to my highest role. Please choose a lower role or move my role higher in the hierarchy.',
                    flags: [Discord.MessageFlags.Ephemeral],
                });
            }
        }
        
        const existingConfig = await LeonShrineEventConfig.findOne({
            where: { guild_id: guildId }
        });
        
        if (existingConfig) {
            const confirmRow = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('confirm_update')
                        .setLabel('Yes, Override')
                        .setStyle(Discord.ButtonStyle.Danger),
                    new Discord.ButtonBuilder()
                        .setCustomId('cancel_update')
                        .setLabel('No, Keep Current')
                        .setStyle(Discord.ButtonStyle.Secondary),
                );
            
            const comparisonEmbed = new Discord.EmbedBuilder()
                .setTitle('Existing Configuration Found')
                .setDescription('⚠️ There is already a configuration for the Leon Shrine event in this server. Do you want to override it?')
                .setColor(0xFF9900)
                .addFields(
                    { 
                        name: 'Current Channel', 
                        value: existingConfig.channel_id ? `<#${existingConfig.channel_id}>` : 'Not set',
                        inline: false 
                    },
                    { 
                        name: 'New Channel', 
                        value: `<#${channel.id}>`,
                        inline: false 
                    },
                    { 
                        name: 'Current Sticker ID', 
                        value: existingConfig.sticker_id || 'Not set',
                        inline: false 
                    },
                    { 
                        name: 'New Sticker ID', 
                        value: stickerId,
                        inline: false 
                    },
                    { 
                        name: 'Current Role', 
                        value: existingConfig.role_id ? `<@&${existingConfig.role_id}>` : 'Not set',
                        inline: false 
                    },
                    { 
                        name: 'New Role', 
                        value: `<@&${role.id}>`,
                        inline: false 
                    }
                )
                .setFooter({ text: 'Please confirm if you want to override the existing configuration' })
                .setTimestamp();
            
            if (existingConfig.sticker_id) {
                try {
                    const existingSticker = await interaction.client.fetchSticker(existingConfig.sticker_id).catch(() => null);
                    if (existingSticker) {
                        comparisonEmbed.setThumbnail(existingSticker.url);
                    }
                } catch (error) {
                    console.error('Error fetching existing sticker for comparison embed:', error);
                }
            }
            
            await interaction.reply({
                embeds: [comparisonEmbed],
                components: [confirmRow],
                flags: [Discord.MessageFlags.Ephemeral]
            });
            
            const confirmMessage = await interaction.fetchReply();
            
            const collector = confirmMessage.createMessageComponentCollector({
                componentType: Discord.ComponentType.Button,
                time: 60000
            });
            
            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: 'Only the user who initiated this command can use these buttons.',
                        flags: [Discord.MessageFlags.Ephemeral]
                    });
                    return;
                }
                
                if (buttonInteraction.customId === 'confirm_update') {
                    const updateData = { 
                        channel_id: channel.id,
                        sticker_id: stickerId,
                        role_id: role.id
                    };
                    
                    await existingConfig.update(updateData);
                    
                    confirmRow.components.forEach(button => button.setDisabled(true));
                    
                    const successEmbed = new Discord.EmbedBuilder()
                        .setTitle('Configuration Updated')
                        .setDescription('✅ The Leon Shrine event configuration has been overridden with new values.')
                        .setColor(0x00FF00)
                        .addFields(
                            { name: 'Channel', value: `${channel}`, inline: false },
                            { name: 'Sticker ID', value: stickerId, inline: false },
                            { name: 'Role', value: `${role}`, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Use /leon-shrine status to view the configuration' });
                    
                    try {
                        const sticker = await interaction.client.fetchSticker(stickerId).catch(() => null);
                        if (sticker) {
                            successEmbed.setThumbnail(sticker.url);
                        }
                    } catch (error) {
                        console.error('Error fetching sticker for config embed:', error);
                    }
                    
                    await buttonInteraction.update({
                        embeds: [successEmbed],
                        components: []
                    });
                    
                    collector.stop('buttonClicked');
                    
                } else if (buttonInteraction.customId === 'cancel_update') {
                    confirmRow.components.forEach(button => button.setDisabled(true));
                    
                    const cancelEmbed = new Discord.EmbedBuilder()
                        .setTitle('Update Cancelled')
                        .setDescription('✅ Operation cancelled. The existing configuration has been kept.')
                        .setColor(0x3498db)
                        .setTimestamp();
                        
                    await buttonInteraction.update({
                        embeds: [cancelEmbed],
                        components: []
                    });
                    
                    collector.stop('buttonClicked');
                }
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    confirmRow.components.forEach(button => button.setDisabled(true));
                    try {
                        const timeoutEmbed = new Discord.EmbedBuilder()
                            .setTitle('Operation Timed Out')
                            .setDescription('⏱️ The configuration update request has timed out. No changes were made.')
                            .setColor(0xC0C0C0)
                            .setTimestamp();
                            
                        await interaction.editReply({
                            embeds: [timeoutEmbed],
                            components: []
                        });
                    } catch (error) {
                        console.error('Error updating timed out message:', error);
                    }
                }
            });
            
        } else {
            const config = await LeonShrineEventConfig.create({
                guild_id: guildId,
                channel_id: channel.id,
                sticker_id: stickerId,
                role_id: role.id,
                active: false
            });
            
            const successEmbed = new Discord.EmbedBuilder()
                .setTitle('Leon Shrine Event Configuration')
                .setDescription('✅ Event successfully configured!')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Channel', value: `${channel}`, inline: false },
                    { name: 'Sticker ID', value: stickerId, inline: false },
                    { name: 'Role', value: `${role}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Use /leon-shrine activate to start the event' });
            
            try {
                const sticker = await interaction.client.fetchSticker(stickerId).catch(() => null);
                if (sticker) {
                    successEmbed.setThumbnail(sticker.url);
                }
            } catch (error) {
                console.error('Error fetching sticker for config embed:', error);
            }
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: [Discord.MessageFlags.Ephemeral]
            });
        }
    } catch (err) {
        console.error('Error executing config command:', err);
        throw err;
    }
}

module.exports = { execute };
