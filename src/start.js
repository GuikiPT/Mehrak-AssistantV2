const fs = require('fs');
const path = require('path');
const moment = require('moment');
const colors = require('colors/safe');
const betterLogging = require('better-logging');

function getLogDirectory() {
    const baseDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
    return path.join(baseDir, moment().format('YYYY'), moment().format('M'), moment().format('D'));
}

async function ConfigureBetterLoggingSystem() {
    const logToFile = process.env.LogToFile === 'true';
    const logDir = getLogDirectory();

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    betterLogging(console, {
        format: ctx => `[${moment().format('HH:mm:ss')}] [${moment().format('L')}] ${ctx.type} >> ${ctx.msg}`,
        saveToFile: logToFile ? path.join(logDir, 'log.txt') : null,
    });
}

const { deploySlashCommands } = require('./slashDeployer');
const { startBot } = require('./bot');
const figlet = require('figlet-promised');

let versionInfo = 'Version info not available';
if (fs.existsSync('./package.json')) {
    const packageInfo = require('../package.json');
    versionInfo = `Version: ${packageInfo.version} | By: ${packageInfo.author}`;
}

async function displayBanner() {
    try {
        const figletResult = await figlet('MehRak-Assistant');
        process.stdout.write(colors.bold(colors.red(figletResult) + '\n'));

        const maxFigletWidth = Math.max(...figletResult.split("\n").map(line => line.length));
        const padding = ' '.repeat(Math.ceil((maxFigletWidth - versionInfo.length) / 2));
        process.stdout.write(colors.red(`${padding}${colors.bold(versionInfo)}\n`));
    } catch (error) {
        console.warn(colors.yellow("Failed to generate ASCII banner."));
    }
}

async function promptForDeployment() {
    const ask = () => {
        process.stdout.write(colors.cyan('Do you want to deploy slash commands before starting the bot? (y/N): '));

        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                process.stdout.write('\n');
                console.warn(colors.yellow('\nNo response received. Proceeding to start the bot without deploying commands...\n'));
                process.stdin.pause();
                resolve(false);
            }, 15000);

            process.stdin.once('data', data => {
                clearTimeout(timeout);
                const input = data.toString().trim().toLowerCase();
                if (input === 'y' || input === 'n') {
                    process.stdin.pause();
                    resolve(input === 'y');
                } else {
                    console.warn(colors.yellow("Invalid input. Please enter 'y' or 'n'."));
                    ask().then(resolve);
                }
            });

            process.stdin.resume();
        });
    };
    return ask();
}

(async () => {
    await ConfigureBetterLoggingSystem();
    
    await displayBanner();

    const deploy = await promptForDeployment();

    if (deploy) {
        console.info(colors.green('Deploying slash commands...'));
        await deploySlashCommands();
        console.info(colors.green('Slash commands deployed successfully.\n'));
    }
    await startBot();
})();
