const Discord = require('discord.js');
const colors = require('colors/safe');

const COMMAND_ERROR_MESSAGE = 'There was an error while executing this command!';

module.exports = {
    name: Discord.Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
            const command = getCommand(interaction);
            if (!command) return;

            try {
                if (interaction.isChatInputCommand()) {
                    await executeCommand(command, interaction);
                } else if (interaction.isAutocomplete() && command.autocomplete) {
                    await executeAutocomplete(command, interaction);
                }
            } catch (error) {
                console.error(colors.red(`Error in ${interaction.isChatInputCommand() ? 'command' : 'autocomplete'}: ${error.stack || error}`))
                await handleInteractionError(interaction, COMMAND_ERROR_MESSAGE);
            }
        }
    },
};

function getCommand(interaction) {
    const command = interaction.client.slashsCmds.get(interaction.commandName);
    if (!command) {
        console.warn(colors.yellow(`Command ${interaction.commandName} not found.`));
    } else if (interaction.isAutocomplete() && !command.autocomplete) {
        console.warn(colors.yellow(`Autocomplete handler for ${interaction.commandName} not found.`));
    }
    return command;
}

async function executeCommand(command, interaction) {
    try {
        await command.execute(interaction);
    } catch (error) {
        throw new Error(`Execution error in command ${interaction.commandName}: ${error.message}`);
    }
}

async function executeAutocomplete(command, interaction) {
    try {
        await command.autocomplete(interaction);
    } catch (error) {
        throw new Error(`Execution error in autocomplete for ${interaction.commandName}: ${error.message}`);
    }
}

async function handleInteractionError(interaction, errorMessage) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    } catch (error) {
        console.error(colors.red(`Error sending interaction error message: ${error.stack || error}`))
    }
}
