const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const colors = require('colors/safe');

/**
 * @type {string}
 */
const COMMAND_ERROR_MESSAGE = '❌ An error occurred while executing this command.';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription("Displays the bot's current latency.")
		.addBooleanOption(option =>
			option.setName('private')
				.setDescription('Whether the response should be private (ephemeral)')
					),
	/**
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @returns {Promise<void>}
	 */
	async execute(interaction) {
		/**
		 * @type {boolean}
		 */
		const isPrivate = interaction.options.getBoolean('private') || false;

		try {
			await interaction.deferReply({ 
				flags: isPrivate ? MessageFlags.Ephemeral : 0,
			});

			/**
			 * @type {import('discord.js').Message}
			 */
			const sent = await interaction.fetchReply();			
			
			/**
			 * @type {number}
			 */
			const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
			
			/**
			 * @type {number}
			 */
			const apiLatency = Math.round(interaction.client.ws.ping);

			/**
			 * @param {number} ms
			 * @returns {string}
			 */
			const formatPing = (ms) => {
				if (ms < 100) return "```diff\n+ ${ms}ms\n```".replace("${ms}", ms);
				if (ms < 200) return "```fix\n${ms}ms\n```".replace("${ms}", ms);
				return "```diff\n- ${ms}ms\n```".replace("${ms}", ms);
			};
			
			/**
			 * @returns {number}
			 */
			const getEmbedColor = () => {
				const highestLatency = Math.max(botLatency, apiLatency);
				if (highestLatency < 100) return 0x2ECC71; // Green
				if (highestLatency < 200) return 0xF1C40F; // Yellow
				return 0xE74C3C; // Red
			};

			/**
			 * @type {import('discord.js').EmbedBuilder}
			 */
			const pingEmbed = new EmbedBuilder()
				.setTitle('🏓 Pong!')
				.setColor(getEmbedColor())
				.addFields(
					{ name: 'Bot Latency', value: formatPing(botLatency), inline: true },
					{ name: 'API Latency', value: formatPing(apiLatency), inline: true }
					)
				.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 1024 }))
				.setTimestamp();

			await interaction.editReply({ 
				embeds: [pingEmbed], 
				flags: isPrivate ? MessageFlags.Ephemeral : 0 
			});

			if (process.env.DEBUG) {
				console.log(colors.cyan(`[DEBUG] Bot Latency: ${botLatency}ms | API Latency: ${apiLatency}ms`));
			}
		} catch (error) {
			await handleCommandError(interaction, 'retrieving latency', error, isPrivate);
		}
	},
};

/**
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} action
 * @param {Error} error
 * @param {boolean} isPrivate
 * @returns {Promise<void>}
 */
async function handleCommandError(interaction, action, error, isPrivate) {
	const errorMessage = `${COMMAND_ERROR_MESSAGE} while ${action}. Please try again later.`;

	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ 
				content: errorMessage, 
				flags: isPrivate ? MessageFlags.Ephemeral : 0 
			});
		} else {
			await interaction.reply({ 
				content: errorMessage, 
				flags: isPrivate ? MessageFlags.Ephemeral : 0 
			});
		}
		console.error(colors.red(`Error ${action}: ${error.stack || error}`));
	} catch (replyError) {
		console.error(colors.red(`Failed to send error message: ${replyError.stack || replyError}`));
	}
}
