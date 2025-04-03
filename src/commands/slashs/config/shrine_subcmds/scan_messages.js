/**
 * @fileoverview Handles scanning messages for Leon Shrine Event stickers
 * @module commands/slashs/config/shrine_subcmds/scan_messages
 */
const Discord = require('discord.js');
const { LeonShrineEventConfig, LeonShrineEventUsers } = require('../../../../database/models/LeonShrineEvent');
const colors = require('colors/safe');

const BATCH_SIZE = 10;
const FETCH_DELAY_MS = 1000;
const PROCESS_DELAY_MS = 250;
const ROLE_ASSIGN_DELAY_MS = 1000;
const UPDATE_FREQUENCY = 2; // Update progress every 2 batches
const MAX_RETRY_ATTEMPTS = 3;

const fs = require('fs').promises;
const path = require('path');

/**
 * Execute the scan-messages subcommand
 * @param {Discord.CommandInteraction} interaction 
 * @param {string} guildId
 * @returns {Promise<void>}
 */
async function execute(interaction, guildId) {
    try {
        const config = await LeonShrineEventConfig.findOrCreateConfig(guildId);
        
        if (!config.channel_id || !config.sticker_id) {
            return await interaction.reply({
                content: '⚠️ Cannot scan messages: Event is not fully configured. Use `/leon-shrine-event config` first.',
            });
        }
        
        const channel = interaction.client.channels.cache.get(config.channel_id);
        if (!channel) {
            return await interaction.reply({
                content: '❌ Cannot scan messages: Configured channel not found. It may have been deleted.',
            });
        }
        
        const currentEventId = `${config.id}`;
        
        await interaction.deferReply();
        
        // Initialize an array to hold role assignment failures for later retries
        const roleRetryQueue = [];
        
        const processingResults = await processAllMessages(channel, config, currentEventId, interaction, roleRetryQueue);
        
        // Process any role assignment failures by retrying
        await processRoleRetryQueue(roleRetryQueue, config, currentEventId, processingResults);
        
        const resultsEmbed = new Discord.EmbedBuilder()
            .setTitle('Message Scan Complete')
            .setColor(0x00FF00)
            .setDescription('✅ Finished scanning messages in the configured channel')
            .addFields(
                { name: 'Messages Scanned', value: `${processingResults.messagesScanned}`, inline: true },
                { name: 'Matching Stickers Found', value: `${processingResults.matchingStickers}`, inline: true },
                { name: 'New Roles Assigned', value: `${processingResults.rolesAssigned}`, inline: true },
                { name: 'Already Processed', value: `${processingResults.alreadyProcessed}`, inline: true },
                { name: 'Errors Encountered', value: `${processingResults.errors}`, inline: true },
                { name: 'Processing Time', value: `${formatTime(processingResults.processingTime)}`, inline: true }
            )
            .setTimestamp();
            
        try {
            const sticker = await interaction.client.fetchSticker(config.sticker_id).catch(() => null);
            if (sticker) {
                resultsEmbed.setThumbnail(sticker.url);
            }
        } catch (error) {
            console.error(colors.red(`Error fetching sticker for scan results: ${error.message}`));
        }
        
        // Generate detailed report
        const reportPath = await generateScanReport(processingResults);
        
        await interaction.editReply({
            embeds: [resultsEmbed],
            files: [reportPath]
        });
        
    } catch (err) {
        console.error(colors.red(`Error executing scan-messages command: ${err.stack || err}`));
        
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `❌ An error occurred while scanning messages: ${err.message}`,
            });
        } else {
            await interaction.reply({
                content: `❌ An error occurred while scanning messages: ${err.message}`,
            });
        }
    }
}

/**
 * Process all messages in a channel with pagination and rate limiting
 * @param {Discord.TextChannel} channel - The channel to scan
 * @param {Object} config - The Leon Shrine configuration
 * @param {string} eventId - The current event ID
 * @param {Discord.CommandInteraction} interaction - The interaction for progress updates
 * @param {Array} roleRetryQueue - Array to hold failed role assignments for retry
 * @returns {Promise<Object>} - Processing results statistics
 */
async function processAllMessages(channel, config, eventId, interaction, roleRetryQueue) {
    const startTime = Date.now();
    
    const results = {
        messagesScanned: 0,
        matchingStickers: 0,
        rolesAssigned: 0,
        alreadyProcessed: 0,
        errors: 0,
        processingTime: 0,
        assignedUsers: [], // Store users who received roles
        errorLog: [], // Store detailed error logs
        unknownMembers: [], // Store users who couldn't be assigned roles
        nonMatchingStickers: [], // Store messages with stickers that don't match
        messagesWithoutStickers: [], // Store messages without any stickers
        matchingStickerMessages: [] // Track all messages with matching stickers
    };
    
    const processedUsers = new Set();
    
    let lastMessageId = null;
    let keepFetching = true;
    let progressUpdate = 0;
    
    while (keepFetching) {
        try {
            const options = { limit: BATCH_SIZE };
            if (lastMessageId) {
                options.before = lastMessageId;
            }
            
            const messages = await channel.messages.fetch(options);
            
            results.messagesScanned += messages.size;
            progressUpdate++;
            
            if (progressUpdate % UPDATE_FREQUENCY === 0) {
                await interaction.editReply({
                    content: `📊 Progress update: Scanned ${results.messagesScanned} messages, found ${results.matchingStickers} stickers, assigned ${results.rolesAssigned} roles, encountered ${results.errors} errors...`
                });
            }
            
            if (messages.size < BATCH_SIZE) {
                keepFetching = false;
            }
            
            if (messages.size > 0) {
                const lastMessage = messages.last();
                lastMessageId = lastMessage.id;
                
                await processMessageBatch(messages, config, eventId, processedUsers, results, roleRetryQueue);
            } else {
                keepFetching = false;
            }
            
            await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS));
            
        } catch (error) {
            console.error(colors.red(`Error fetching messages: ${error.stack || error}`));
            results.errors++;
            results.errorLog.push({
                timestamp: new Date().toISOString(),
                type: 'FetchError',
                message: error.message,
                code: error.code
            });
            
            if (error.code === 429) {
                const retryAfter = error.retry_after || 5;
                console.warn(colors.yellow(`Rate limited while fetching messages. Waiting ${retryAfter}s before retrying...`));
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            } else {
                await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS * 2));
            }
        }
    }
    
    results.processingTime = Date.now() - startTime;
    
    return results;
}

/**
 * Process a batch of messages
 * @param {Discord.Collection<string, Discord.Message>} messages - Collection of messages
 * @param {Object} config - Leon Shrine configuration
 * @param {string} eventId - Current event ID
 * @param {Set<string>} processedUsers - Set of already processed user IDs
 * @param {Object} results - Results statistics object to update
 * @param {Array} roleRetryQueue - Array to store failed role assignments for retry
 * @returns {Promise<void>}
 */
async function processMessageBatch(messages, config, eventId, processedUsers, results, roleRetryQueue) {
    const messagesArray = Array.from(messages.values()).reverse();
    
    for (const message of messagesArray) {
        try {
            const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
            
            // Log non-bot messages without stickers
            if (!message.author.bot && !message.stickers.size) {
                results.messagesWithoutStickers.push({
                    username: message.author.username,
                    id: message.author.id,
                    link: messageLink,
                    timestamp: message.createdAt.toISOString(),
                    content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
                });
            }
            
            // Skip messages from bots or with no stickers for further processing
            if (message.author.bot || !message.stickers.size) {
                continue;
            }
            
            // Check if any of the stickers match the target sticker
            const hasMatchingSticker = message.stickers.some(sticker => sticker.id === config.sticker_id);
            
            // Log the message based on whether it matches or not
            if (hasMatchingSticker) {
                results.matchingStickers++;
                results.matchingStickerMessages.push({
                    username: message.author.username,
                    id: message.author.id,
                    link: messageLink,
                    timestamp: message.createdAt.toISOString(),
                    processed: false
                });
            } else {
                results.nonMatchingStickers.push({
                    username: message.author.username,
                    id: message.author.id,
                    link: messageLink,
                    stickerIds: Array.from(message.stickers.keys()),
                    timestamp: message.createdAt.toISOString()
                });
            }
            
            // If this user has been processed already, skip role assignment
            if (processedUsers.has(message.author.id)) {
                continue;
            }
            
            // Continue with processing if the sticker matches
            if (hasMatchingSticker) {
                try {
                    // Check if user already participated in this event
                    const existingParticipation = await LeonShrineEventUsers.findOne({
                        where: {
                            guild_id: message.guild.id,
                            user_id: message.author.id,
                            event_id: eventId
                        }
                    });
                    
                    if (existingParticipation) {
                        // If the user has already been added (addedToRole true), mark as already processed
                        if (existingParticipation.addedToRole) {
                            results.alreadyProcessed++;
                            const index = results.matchingStickerMessages.findIndex(
                                item => item.id === message.author.id && item.link === messageLink
                            );
                            if (index !== -1) {
                                results.matchingStickerMessages[index].processed = true;
                                results.matchingStickerMessages[index].status = 'already_processed';
                            }
                        }
                        processedUsers.add(message.author.id);
                        continue;
                    }
                    
                    // Validate data before attempting to create a record
                    if (!message.guild.id || !message.author.id || !eventId) {
                        console.error(colors.red(`Missing required data for user record: Guild ID: ${message.guild.id}, User ID: ${message.author.id}, Event ID: ${eventId}`));
                        results.errorLog.push({
                            timestamp: new Date().toISOString(),
                            type: 'ValidationError',
                            username: message.author.username,
                            userId: message.author.id,
                            message: 'Missing required data for record creation'
                        });
                        results.errors++;
                        continue;
                    }
                    
                    // Create user participation record with explicit data validation
                    await LeonShrineEventUsers.create({
                        guild_id: message.guild.id,
                        user_id: message.author.id,
                        event_id: eventId,
                        addedToRole: false
                    });
                    
                    processedUsers.add(message.author.id);
                    
                    if (config.role_id) {
                        try {
                            let member = message.member;
                            if (!member) {
                                try {
                                    member = await message.guild.members.fetch(message.author.id);
                                } catch (fetchError) {
                                    // Handle unknown member error
                                    if (fetchError.code === 10007 || fetchError.message.includes('Unknown Member')) {
                                        const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
                                        const errorMsg = `[${timestamp}] [error] >> Error assigning role to ${message.author.username}: Unknown Member`;
                                        console.error(colors.yellow(errorMsg));
                                        
                                        results.unknownMembers.push({
                                            username: message.author.username,
                                            id: message.author.id,
                                            error: 'Unknown Member'
                                        });
                                        
                                        continue;
                                    } else {
                                        throw fetchError;
                                    }
                                }
                            }
                            
                            // Attempt to assign the role if the member does not have it
                            if (member && !member.roles.cache.has(config.role_id)) {
                                await member.roles.add(config.role_id);
                                results.rolesAssigned++;
                                
                                results.assignedUsers.push({
                                    username: message.author.username,
                                    id: message.author.id
                                });
                                
                                // Update the database record to mark that the user was added to the role
                                await LeonShrineEventUsers.update(
                                    { addedToRole: true },
                                    { where: { guild_id: message.guild.id, user_id: message.author.id, event_id: eventId } }
                                );
                                
                                // Update the message tracking with successful processing
                                const index = results.matchingStickerMessages.findIndex(
                                    item => item.id === message.author.id && item.link === messageLink
                                );
                                if (index !== -1) {
                                    results.matchingStickerMessages[index].processed = true;
                                    results.matchingStickerMessages[index].status = 'processed';
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, ROLE_ASSIGN_DELAY_MS));
                            }
                        } catch (roleError) {
                            if (roleError.code === 429) {
                                const retryAfter = roleError.retry_after || 5;
                                console.warn(colors.yellow(`Rate limited while assigning roles. Waiting ${retryAfter}s before continuing...`));
                                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            } else {
                                const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
                                const errorMsg = `[${timestamp}] [error] >> Error assigning role to ${message.author.username}: ${roleError.message}`;
                                console.error(colors.red(errorMsg));
                                
                                results.errorLog.push({
                                    timestamp: new Date().toISOString(),
                                    type: 'RoleAssignmentError',
                                    username: message.author.username,
                                    userId: message.author.id,
                                    message: roleError.message
                                });
                                
                                results.errors++;
                                // Push to retry queue if not already there
                                roleRetryQueue.push({
                                    message,
                                    attempts: 1
                                });
                            }
                        }
                    }
                } catch (dbError) {
                    if (dbError.name === 'SequelizeValidationError' || dbError.name === 'ValidationError') {
                        console.error(colors.red(`Database validation error for message ${message.id}. User: ${message.author.id}, Guild: ${message.guild.id}, Event: ${eventId}`));
                        
                        if (dbError.errors && Array.isArray(dbError.errors)) {
                            dbError.errors.forEach(err => {
                                console.error(colors.yellow(`  - ${err.path}: ${err.message}`));
                            });
                        }
                        
                        if (dbError.errors && dbError.errors.some(e => e.path === 'guild_id' || e.path === 'user_id' || e.path === 'event_id')) {
                            console.log(colors.blue('Attempting to fix validation issue with cleaned data...'));
                            
                            try {
                                await LeonShrineEventUsers.create({
                                    guild_id: String(message.guild.id).trim(),
                                    user_id: String(message.author.id).trim(),
                                    event_id: String(eventId).trim(),
                                    addedToRole: false
                                });
                                
                                console.log(colors.green(`Successfully created record with cleaned data for user ${message.author.username}`));
                                processedUsers.add(message.author.id);
                                continue;
                            } catch (retryError) {
                                console.error(colors.red(`Retry with cleaned data failed: ${retryError.message}`));
                            }
                        }
                    } else if (dbError.name === 'SequelizeUniqueConstraintError') {
                        console.log(colors.yellow(`Duplicate entry detected for user ${message.author.username} in event ${eventId}`));
                        processedUsers.add(message.author.id);
                        results.alreadyProcessed++;
                        continue;
                    } else {
                        console.error(colors.red(`Database error processing message ${message.id}: ${dbError.message}`));
                    }
                    
                    results.errorLog.push({
                        timestamp: new Date().toISOString(),
                        type: 'DatabaseError',
                        username: message.author.username,
                        userId: message.author.id,
                        message: dbError.message,
                        details: dbError.errors ? dbError.errors.map(e => `${e.path}: ${e.message}`).join(', ') : ''
                    });
                    
                    results.errors++;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, PROCESS_DELAY_MS));
            
        } catch (error) {
            const errorDetails = {
                messageId: message.id,
                authorId: message.author?.id || 'unknown',
                username: message.author?.username || 'unknown',
                guildId: message.guild?.id || 'unknown',
                errorName: error.name,
                errorMessage: error.message
            };
            
            console.error(colors.red(`Error processing message ${message.id}: ${error.message}`));
            console.error(colors.yellow(`Error context: ${JSON.stringify(errorDetails)}`));
            
            results.errorLog.push({
                timestamp: new Date().toISOString(),
                type: 'ProcessingError',
                ...errorDetails
            });
            
            results.errors++;
        }
    }
}

/**
 * Retry role assignments for users that previously failed, up to MAX_RETRY_ATTEMPTS.
 * @param {Array} retryQueue - Array of objects { message, attempts }
 * @param {Object} config - The event configuration
 * @param {string} eventId - The current event ID
 * @param {Object} results - The processing results object to update
 */
async function processRoleRetryQueue(retryQueue, config, eventId, results) {
    while (retryQueue.length > 0) {
        const currentRetries = [...retryQueue];
        retryQueue.length = 0;
        
        for (const item of currentRetries) {
            const { message } = item;
            let attempts = item.attempts;
            try {
                let member = message.member;
                if (!member) {
                    try {
                        member = await message.guild.members.fetch(message.author.id);
                    } catch (fetchError) {
                        console.error(colors.yellow(`Retry fetch: Unknown Member for ${message.author.username}`));
                        continue;
                    }
                }
                if (member.roles.cache.has(config.role_id)) {
                    continue;
                }
                await member.roles.add(config.role_id);
                results.rolesAssigned++;
                results.assignedUsers.push({
                    username: message.author.username,
                    id: message.author.id
                });
                await LeonShrineEventUsers.update(
                    { addedToRole: true },
                    { where: { guild_id: message.guild.id, user_id: message.author.id, event_id: eventId } }
                );
                await new Promise(resolve => setTimeout(resolve, ROLE_ASSIGN_DELAY_MS));
            } catch (retryError) {
                attempts++;
                console.error(colors.red(`Retry attempt ${attempts} failed for ${message.author.username}: ${retryError.message}`));
                if (attempts < MAX_RETRY_ATTEMPTS) {
                    retryQueue.push({ message, attempts });
                } else {
                    results.errorLog.push({
                        timestamp: new Date().toISOString(),
                        type: 'RoleAssignmentError',
                        username: message.author.username,
                        userId: message.author.id,
                        message: `Failed after ${attempts} attempts: ${retryError.message}`
                    });
                    results.errors++;
                }
            }
        }
        if (retryQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, ROLE_ASSIGN_DELAY_MS));
        }
    }
}

/**
 * Generate a markdown report file with detailed scan results
 * @param {Object} results - The scan results
 * @returns {Promise<string>} - Path to the generated report file
 */
async function generateScanReport(results) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const reportDir = path.join(process.cwd(), 'scan-reports');
    const reportPath = path.join(reportDir, `scan-report-${timestamp}.md`);
    
    try {
        await fs.mkdir(reportDir, { recursive: true });
        
        let reportContent = `# Leon Shrine Event Scan Report\n\n`;
        reportContent += `Generated: ${new Date().toISOString()}\n\n`;
        
        reportContent += `## Summary\n\n`;
        reportContent += `- **Messages Scanned**: ${results.messagesScanned}\n`;
        reportContent += `- **Matching Stickers Found**: ${results.matchingStickers}\n`;
        
        const totalMatching = results.matchingStickers;
        const totalProcessed = results.rolesAssigned + results.alreadyProcessed + results.unknownMembers.length;
        const unaccountedFor = totalMatching - totalProcessed;
        
        if (unaccountedFor > 0) {
            reportContent += `- **Unprocessed Matching Stickers**: ${unaccountedFor} *(see explanation below)*\n`;
        }
        
        reportContent += `- **Non-Matching Stickers Found**: ${results.nonMatchingStickers.length}\n`;
        reportContent += `- **Messages Without Stickers**: ${results.messagesWithoutStickers.length}\n`;
        reportContent += `- **New Roles Assigned**: ${results.rolesAssigned}\n`;
        reportContent += `- **Already Processed Users**: ${results.alreadyProcessed}\n`;
        reportContent += `- **Errors Encountered**: ${results.errors}\n`;
        reportContent += `- **Unknown Members**: ${results.unknownMembers.length}\n`;
        reportContent += `- **Processing Time**: ${formatTime(results.processingTime)}\n\n`;
        
        if (unaccountedFor > 0) {
            reportContent += `## Sticker Discrepancy Explanation\n\n`;
            reportContent += `The scan found ${totalMatching} messages with matching stickers, but only processed ${totalProcessed} of them:\n\n`;
            reportContent += `- **Roles Assigned**: ${results.rolesAssigned}\n`;
            reportContent += `- **Already Processed Users**: ${results.alreadyProcessed}\n`;
            reportContent += `- **Unknown Members**: ${results.unknownMembers.length}\n\n`;
            reportContent += `The remaining ${unaccountedFor} messages were likely from users who sent multiple messages with the target sticker.\n`;
            reportContent += `Only one message per user is processed for role assignment.\n\n`;
        }
        
        reportContent += `## Members Added to Role\n\n`;
        if (results.assignedUsers.length > 0) {
            results.assignedUsers.forEach(user => {
                reportContent += `- **${user.username}** (ID: ${user.id})\n`;
            });
        } else {
            reportContent += `- No members were added to the role.\n`;
        }
        reportContent += `\n`;
        
        reportContent += `## Members Not Assigned Role\n\n`;
        reportContent += `### Unknown Members\n\n`;
        if (results.unknownMembers.length > 0) {
            results.unknownMembers.forEach(user => {
                reportContent += `- **${user.username}** (ID: ${user.id}): Unknown Member\n`;
            });
        } else {
            reportContent += `- None\n`;
        }
        reportContent += `\n`;
        
        const roleAssignmentErrors = results.errorLog.filter(e => e.type === 'RoleAssignmentError');
        reportContent += `### Role Assignment Errors\n\n`;
        if (roleAssignmentErrors.length > 0) {
            roleAssignmentErrors.forEach(err => {
                reportContent += `- **${err.username}** (ID: ${err.userId}): ${err.message}\n`;
            });
        } else {
            reportContent += `- None\n`;
        }
        reportContent += `\n`;
        
        // Messages With Non-Matching Stickers
        reportContent += `## Messages With Non-Matching Stickers\n\n`;
        if (results.nonMatchingStickers.length > 0) {
            results.nonMatchingStickers.forEach(item => {
                reportContent += `- **${item.username}** / ${item.id} / [View Message](${item.link})\n`;
            });
        } else {
            reportContent += `- No messages with non-matching stickers found.\n`;
        }
        reportContent += `\n`;
        
        // Messages Without Stickers
        reportContent += `## Messages Without Stickers\n\n`;
        if (results.messagesWithoutStickers.length > 0) {
            const sortedMessages = results.messagesWithoutStickers.sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );
            
            sortedMessages.forEach(item => {
                reportContent += `- **${item.username}** / ${item.id} / [View Message](${item.link})\n`;
            });
        } else {
            reportContent += `- No messages without stickers found.\n`;
        }
        reportContent += `\n`;
        
        // Detailed error logs
        reportContent += `## Error Logs\n\n`;
        if (results.errorLog.length > 0) {
            for (const error of results.errorLog) {
                reportContent += `### ${error.timestamp}\n`;
                reportContent += `- **Type**: ${error.type}\n`;
                if (error.username) reportContent += `- **User**: ${error.username} (${error.userId})\n`;
                reportContent += `- **Message**: ${error.message}\n\n`;
            }
        } else {
            reportContent += `- No errors logged.\n`;
        }
        
        // All messages with matching stickers (as table not needed per update)
        reportContent += `## All Messages With Matching Stickers\n\n`;
        if (results.matchingStickerMessages.length > 0) {
            results.matchingStickerMessages.forEach(item => {
                reportContent += `- **${item.username}** / ${item.id} / [View Message](${item.link}) / Processed: ${item.processed ? "✅" : "❌"}\n`;
            });
        } else {
            reportContent += `- No messages with matching stickers found (this should not happen).\n`;
        }
        reportContent += `\n`;
        
        await fs.writeFile(reportPath, reportContent);
        return reportPath;
        
    } catch (error) {
        console.error(colors.red(`Error generating report: ${error.message}`));
        const fallbackPath = path.join(process.cwd(), `scan-report-${timestamp}.md`);
        const simpleReport = `# Scan Report\n\nMessages: ${results.messagesScanned}\nStickers: ${results.matchingStickers}\nRoles: ${results.rolesAssigned}\nErrors: ${results.errors}`;
        await fs.writeFile(fallbackPath, simpleReport);
        return fallbackPath;
    }
}

/**
 * Format milliseconds into a readable time string
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted time string
 */
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

module.exports = { execute };
