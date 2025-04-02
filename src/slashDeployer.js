const { REST, Routes, Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const colors = require('colors/safe');
require('dotenv').config();
require('better-logging')(console);
const prompts = require('prompts');

async function deploySlashCommands() {
    console.log(colors.green('Starting Slash Command Deployment System...'));

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    try {
        await client.login(process.env.DiscordToken);
        console.log(colors.green(`Logged in as ${client.user.tag} for Slash Command Deployment.`));

        const actionChoices = [
            { title: 'Register Global Commands', value: 'registerGlobal' },
            { title: 'Register Test Guild Commands', value: 'registerTestGuild' },
            { title: 'Delete Single Global Command', value: 'deleteSingleGlobal' },
            { title: 'Delete Single Test Guild Command', value: 'deleteSingleTestGuild' },
            { title: 'Delete All Global Commands', value: 'deleteAllGlobal' },
            { title: 'Delete All Test Guild Commands', value: 'deleteAllTestGuild' }
        ];

        const { action } = await prompts({
            type: 'select',
            name: 'action',
            message: 'What would you like to do?',
            choices: actionChoices
        });

        let commandName, guildId;

        if (action.startsWith('deleteSingle')) {
            commandName = await promptInput('Enter the command name to delete:', 'Command name is required!');
        }

        if (action.endsWith('TestGuild')) {
            guildId = await promptInput('Enter the test guild ID:', 'Guild ID is required!');
        }

        switch (action) {
            case 'registerGlobal':
                await registerCommands(client);
                break;
            case 'registerTestGuild':
                await registerCommands(client, guildId);
                break;
            case 'deleteSingleGlobal':
                await deleteSingleCommand(client, commandName);
                break;
            case 'deleteSingleTestGuild':
                await deleteSingleCommand(client, commandName, guildId);
                break;
            case 'deleteAllGlobal':
                await confirmAndDeleteAll(client, 'global');
                break;
            case 'deleteAllTestGuild':
                await confirmAndDeleteAll(client, 'test guild', guildId);
                break;
            default:
                console.log(colors.yellow('Invalid action specified.'))
        }
    } catch (error) {
        logError('Error during Slash Command Deployment:', error);
    } finally {
        console.log(colors.yellow('Shutting down Slash Command Deployment System gracefully...'));
        await client.destroy();
    }
}

async function promptInput(message, validationMessage = 'Input is required') {
    const { input } = await prompts({
        type: 'text',
        name: 'input',
        message,
        validate: input => input ? true : validationMessage
    });
    return input;
}

async function confirmAndDeleteAll(client, type, guildId = null) {
    const { confirmDelete } = await prompts({
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete all ${type} commands?`,
        initial: false
    });
    if (confirmDelete) {
        await deleteAllCommands(client, guildId);
    } else {
        console.log(colors.green(`Deletion of all ${type} commands canceled.`));
    }
}

async function loadCommands() {
    const commands = [];
    const slashFolders = fs.readdirSync(__dirname + '/commands/slashs');
    for (const folder of slashFolders) {
        const slashFiles = fs.readdirSync(`${__dirname}/commands/slashs/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of slashFiles) {
            try {
                const slash = require(`${__dirname}/commands/slashs/${folder}/${file}`);
                if ('data' in slash && 'execute' in slash) {
                    commands.push(slash.data.toJSON());
                } else {
                    console.warn(colors.yellow(`[WARNING] The command ${file} is missing "data" or "execute" property.`))
                }
            } catch (error) {
                logError(`Failed to load command ${file}:`, error);
            }
        }
    }
    console.info(colors.green(`Loaded ${commands.length} commands successfully.`))
    return commands;
}

async function registerCommands(client, guildId = null) {
    const commands = await loadCommands();
    const rest = createRestClient();

    try {
        const route = guildId
            ? Routes.applicationGuildCommands(client.user.id, guildId)
            : Routes.applicationCommands(client.user.id);

        const data = await rest.put(route, { body: commands });
        console.info(colors.green(`Successfully reloaded ${data.length} ${guildId ? 'guild-specific' : 'application'} (/) commands.`))
    } catch (error) {
        logError('Error registering commands:', error);
    }
}

async function deleteSingleCommand(client, commandName, guildId = null) {
    const rest = createRestClient();

    try {
        const route = guildId
            ? Routes.applicationGuildCommands(client.user.id, guildId)
            : Routes.applicationCommands(client.user.id);

        const commands = await rest.get(route);
        const command = commands.find(cmd => cmd.name === commandName);
        if (!command) {
            colors.warn(colors.yellow(`No command found with name: ${commandName}`));
            return;
        }

        const deleteRoute = guildId
            ? Routes.applicationGuildCommand(client.user.id, guildId, command.id)
            : Routes.applicationCommand(client.user.id, command.id);

        await rest.delete(deleteRoute);
        console.log(colors.green(`Successfully deleted command: ${commandName}`))
    } catch (error) {
        logError('Error deleting command:', error);
    }
}

async function deleteAllCommands(client, guildId = null) {
    const rest = createRestClient();

    try {
        const route = guildId
            ? Routes.applicationGuildCommands(client.user.id, guildId)
            : Routes.applicationCommands(client.user.id);

        await rest.put(route, { body: [] });
        console.log(colors.green(`Successfully deleted all ${guildId ? 'guild-specific' : 'application'} commands.`))
    } catch (error) {
        logError('Error deleting all commands:', error);
    }
}

function createRestClient() {
    return new REST({ version: '10' }).setToken(process.env.DiscordToken);
}

module.exports = { deploySlashCommands };
