const colors = require('colors/safe');
const Discord = require('discord.js');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MEMORY_THRESHOLD_MB = 5;
const MEMORY_CHECK_INTERVAL_MS = 60000;
let lastMemoryUsage = 0;

const INTENTS = [
    Discord.GatewayIntentBits.AutoModerationConfiguration,
    Discord.GatewayIntentBits.AutoModerationExecution,
    Discord.GatewayIntentBits.DirectMessageReactions,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.GuildEmojisAndStickers,
    Discord.GatewayIntentBits.GuildIntegrations,
    Discord.GatewayIntentBits.GuildInvites,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildModeration,
    Discord.GatewayIntentBits.GuildPresences,
    Discord.GatewayIntentBits.GuildScheduledEvents,
    Discord.GatewayIntentBits.GuildVoiceStates,
    Discord.GatewayIntentBits.GuildWebhooks,
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.MessageContent,
];

const PARTIALS = [
    Discord.Partials.Channel,
    Discord.Partials.GuildMember,
    Discord.Partials.GuildScheduledEvent,
    Discord.Partials.Message,
    Discord.Partials.Reaction,
    Discord.Partials.ThreadMember,
    Discord.Partials.User,
];

async function startBot() {
    async function initializeBot() {
        try {
            checkEnvironmentVariables();

            console.info(colors.yellow('Starting the Bot . . .'));

            await startBotInstance();
        } catch (error) {
            logError(`Initialization error: ${error.stack}`);
            process.exit(1);
        }
    }

    initializeBot();

    function checkEnvironmentVariables() {
        const requiredEnvVars = ['DiscordToken'];
        for (const varName of requiredEnvVars) {
            if (!process.env[varName]) {
                throw new Error(`Environment variable ${varName} is missing.`);
            }
        }
    }

    async function startBotInstance() {
        client = new Discord.Client({ intents: INTENTS, partials: PARTIALS });
        client.slashsCmds = new Discord.Collection();

        try {
            const handlerFiles = fs.readdirSync(path.join(__dirname, 'handlers')).filter(file => file.endsWith('.js'));
            for (const file of handlerFiles) {
                const handler = require(`./handlers/${file}`);
                await handler(client);
            }

            await client.login(process.env.DiscordToken);

            process.on('SIGINT', shutdownBot);
            process.on('SIGTERM', shutdownBot);
        } catch (error) {
            logError(`Error starting bot: ${error.stack || error}`);
        }
    }

    async function shutdownBot() {

        console.log(colors.yellow('Shutting down bot...'));
        try {
            await client.destroy();
            process.exit();
        } catch (error) {
            logError(`Error during shutdown: ${error.stack}`);
            process.exit(1);
        }
    }

    setInterval(() => {
        const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
        if (Math.abs(memoryUsage - lastMemoryUsage) > MEMORY_THRESHOLD_MB) {
            console.debug(colors.blue(`Memory Usage: RSS: ${memoryUsage.toFixed(2)} MB`));
            lastMemoryUsage = memoryUsage;
        }
    }, MEMORY_CHECK_INTERVAL_MS);
}

function logError(message) {
    console.error(colors.red(message));
}

module.exports = { startBot };
