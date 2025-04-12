const Discord = require("discord.js");

// Import subcommands from the shrine_subcmds folder
const configCommand = require("./shrine_subcmds/config");
const statusCommand = require("./shrine_subcmds/status");
const activateCommand = require("./shrine_subcmds/activate");
const deactivateCommand = require("./shrine_subcmds/deactivate");
const checkStickerIdCommand = require("./shrine_subcmds/check_sticker_id");
const scanMessagesCommand = require("./shrine_subcmds/scan_messages");

/**
 * @type {import('discord.js').SlashCommandBuilder}
 */
module.exports = {
    data: new Discord.SlashCommandBuilder()
        .setName("leon-shrine-event")
        .setDescription("Manage the Leon Shrine event settings.")
        .setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("config")
                .setDescription("Configure the Leon Shrine event.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel where the event will take place.")
                        .setRequired(true)
                        .addChannelTypes([Discord.ChannelType.GuildText])
                )
                .addStringOption((option) =>
                    option
                        .setName("sticker-id")
                        .setDescription("The ID of the sticker to be used for the event.")
                        .setRequired(true)
                )
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("The role to be assigned to participants.")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("status")
                .setDescription("Check the current Leon Shrine event configuration.")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("activate")
                .setDescription("Activate the Leon Shrine event.")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("deactivate")
                .setDescription("Deactivate the Leon Shrine event.")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("check-sticker-id")
                .setDescription("Check a sticker ID by using it in your message.")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("scan-messages")
                .setDescription(
                    "Scan all messages in the configured channel for matching stickers."
                )
        ),

    /**
     * @param {Discord.CommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            const embed = new Discord.EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Leon Shrine Event")
                .setDescription(
                    "⚠️ This command is disabled due to the Leon Shrine event ending.\nIf you want to reuse the command for other event please contact <@!219410026631135232> or <@!926914230924509264>."
                );

            return await interaction.reply({
                embeds: [embed],
                flags: Discord.MessageFlags.Ephemeral,
            });

            // switch(subcommand) {
            //     case 'config':
            //         await configCommand.execute(interaction, guildId);
            //         break;
            //     case 'status':
            //         await statusCommand.execute(interaction, guildId);
            //         break;
            //     case 'activate':
            //         await activateCommand.execute(interaction, guildId);
            //         break;
            //     case 'deactivate':
            //         await deactivateCommand.execute(interaction, guildId);
            //         break;
            //     case 'check-sticker-id':
            //         await checkStickerIdCommand.execute(interaction);
            //         break;
            //     case 'scan-messages':
            //         await scanMessagesCommand.execute(interaction, guildId);
            //         break;
            //     default:
            //         throw new Error(`Unknown subcommand: ${subcommand}`);
            // }
        } catch (error) {
            console.error(`Error executing ${subcommand} subcommand:`, error);

            // Only reply if we haven't already
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ An error occurred while executing the command: ${error.stack || "Unknown error"
                        }`,
                    flags: [Discord.MessageFlags.Ephemeral],
                });
            } else if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: `❌ An error occurred while executing the command: ${error.stack || "Unknown error"
                        }`,
                });
            }
        }
    },
};
