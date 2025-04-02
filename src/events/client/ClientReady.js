const Discord = require('discord.js');
const colors = require('colors/safe');

module.exports = {
	name: Discord.Events.ClientReady,
	once: true,
	/**
	 * @param {Discord.Client} client
	 * @returns {Promise<void>}
	 */
	async execute(client) {
		console.log(colors.green(`Logged in as ${client.user.tag}`))

		/** @type {string} */
		const activity = process.env.DiscordBotActivity || 'Default Activity';
		/** @type {Discord.ActivityType} */
		const activityType = process.env.DiscordBotActivityType || Discord.ActivityType.Playing;
		/** @type {string} */
		const status = process.env.DiscordBotStatus || 'online';

		/**
		 * @returns {void}
		 */
		const validateEnvVariables = () => {
			if (!process.env.DiscordBotActivity) {
				console.warn(colors.yellow('Warning: DiscordBotActivity is not set in environment variables.'))
			}
			if (!process.env.DiscordBotActivityType) {
				console.warn(colors.yellow('Warning: DiscordBotActivityType is not set in environment variables.'))
			}
			if (!process.env.DiscordBotStatus) {
				console.warn(colors.yellow('Warning: DiscordBotStatus is not set in environment variables.'))
			}
		};

		try {
			await client.user.setPresence({
				activities: [{ name: activity, type: activityType }],
				status: status,
			});
			console.log(colors.blue('Presence set successfully.'))
		} catch (error) {
			console.error(colors.red(`Error setting presence: ${error.message}`))
		}

		validateEnvVariables();
	},
};
