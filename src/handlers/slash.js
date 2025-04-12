const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');

/**
 * @param {object} client
 * @returns {Promise<void>}
 */
module.exports = async function (client) {
    /** @type {number} */
    let numberOfLoadedCommands = 0;
    console.info(colors.yellow('Loading Slash Commands Handler . . .'))

    /** @type {string} */
    const commandsPath = path.join(__dirname, '../commands/slashs');
    /** @type {string[]} */
    const commandFolders = fs.readdirSync(commandsPath);

    /**
     * @param {object} command
     * @param {string} filePath
     * @returns {boolean}
     */
    const isValidCommand = (command, filePath) => {
        if (!command || !command.data || !command.data.name) {
            console.error(colors.red(`Invalid command structure in file: '${filePath}'. Missing 'data' or 'data.name'.`));
            return false;
        }
        return true;
    };

    for (const folder of commandFolders) {
        /** @type {string[]} */
        const commandFiles = fs.readdirSync(path.join(commandsPath, folder)).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            /** @type {string} */
            const filePath = path.join(commandsPath, folder, file);
            try {
                /** @type {object} */
                const command = require(filePath);

                if (isValidCommand(command, filePath)) {
                    client.slashsCmds.set(command.data.name, command);
                    numberOfLoadedCommands++;
                    
                    if (process.env.DEBUG) {
                        console.debug(`Loaded command: ${command.data.name} from ${folder}/${file}`);
                    }
                }
            } catch (error) {
                console.error(colors.red(`Failed to load slash command from file: '${filePath}'`));
                console.error(colors.red(error.stack || error.stack));
            }
        }
    }

    console.log(colors.green(`Loaded ${numberOfLoadedCommands} slash commands`));
};
