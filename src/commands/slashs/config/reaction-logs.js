const Discord = require('discord.js');
const ServerConfig = require('../../../database/models/ServerConfig');

/**
 * @type {import('discord.js').SlashCommandBuilder}
 */
module.exports = {
    data: new Discord.SlashCommandBuilder()
        .setName('reaction-log')
        .setDescription('Manage the reaction log channel settings.')
        .setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the reaction log channel.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to log reactions.')
                        .setRequired(true)
                        .addChannelTypes([Discord.ChannelType.GuildText, Discord.ChannelType.PublicThread, Discord.ChannelType.PrivateThread])
                    )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get the current reaction log channel.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable reaction logging.')
        ),
    /**
     * @param {Discord.CommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        switch(subcommand) {
            case 'set': 
                await handleSetCommand(interaction, guildId);
                break;
            case 'get':
                await handleGetCommand(interaction, guildId); 
                break;
            case 'disable':
                await handleDisableCommand(interaction, guildId);
                break;
        }
    },
};

/**
 * @param {Discord.CommandInteraction} interaction
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function handleSetCommand(interaction, guildId) {
    try {
        const channel = interaction.options.getChannel('channel');
        
        const permissions = channel.permissionsFor(interaction.client.user);
        if (!permissions.has(Discord.PermissionFlagsBits.SendMessages) || 
            !permissions.has(Discord.PermissionFlagsBits.ViewChannel)) {
            return await interaction.reply({
                content: '❌ I don\'t have permission to send messages in that channel. Please choose a channel where I have proper permissions.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        const config = await ServerConfig.findOrCreateConfig(guildId);
        const previousChannel = config.reaction_log_channels_id ? 
            interaction.guild.channels.cache.get(config.reaction_log_channels_id) : null;
            
        await config.update({ reaction_log_channels_id: channel.id });

        const replyMessage = previousChannel ? 
            `✅ Reaction log channel updated from ${previousChannel} to ${channel}.` :
            `✅ Reaction log channel has been set to ${channel}. All reactions will now be logged there.`;
            
        await interaction.reply({
            content: replyMessage,
            flags: [Discord.MessageFlags.Ephemeral],
        });

    } catch (err) {
        console.error('Error executing set command:', err);
        await interaction.reply({
            content: `❌ Error: ${err.message || 'There was an error setting the reaction log channel. Please try again later.'}`,
            flags: [Discord.MessageFlags.Ephemeral],
        });
    }
}

/**
 * @param {Discord.CommandInteraction} interaction
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function handleGetCommand(interaction, guildId) {
    try {
        const config = await ServerConfig.findOrCreateConfig(guildId);
        
        if (config.reaction_log_channels_id) {
            const channel = interaction.guild.channels.cache.get(config.reaction_log_channels_id);
            if (channel) {
                await interaction.reply({
                    content: `📝 The current reaction log channel is ${channel}.`,
                    flags: [Discord.MessageFlags.Ephemeral],
                });
            } else {
                await config.update({ reaction_log_channels_id: null });
                await interaction.reply({
                    content: '⚠️ The previously set reaction log channel no longer exists. Logging has been disabled. Please set a new channel using `/reaction-log set`.',
                    flags: [Discord.MessageFlags.Ephemeral],
                });
            }
        } else {
            await interaction.reply({
                content: '⚠️ No reaction log channel is set for this server. Use `/reaction-log set` to configure one.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
    } catch (err) {
        console.error('Error executing get command:', err);
        await interaction.reply({
            content: `❌ Error: ${err.message || 'There was an error retrieving the reaction log channel.'}`,
            flags: [Discord.MessageFlags.Ephemeral],
        });
    }
}

/**
 * @param {Discord.CommandInteraction} interaction
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function handleDisableCommand(interaction, guildId) {
    try {
        const config = await ServerConfig.findOrCreateConfig(guildId);
        
        if (!config.reaction_log_channels_id) {
            return await interaction.reply({
                content: 'ℹ️ Reaction logging is already disabled for this server.',
                flags: [Discord.MessageFlags.Ephemeral],
            });
        }
        
        await config.update({ reaction_log_channels_id: null });
        
        await interaction.reply({
            content: '✅ Reaction logging has been disabled for this server.',
            flags: [Discord.MessageFlags.Ephemeral],
        });
    } catch (err) {
        console.error('Error executing disable command:', err);
        await interaction.reply({
            content: `❌ Error: ${err.message || 'There was an error disabling reaction logging.'}`,
            flags: [Discord.MessageFlags.Ephemeral],
        });
    }
}
