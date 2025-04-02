/**
 * @module database/models/ServerConfig
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../connector');

/**
 * @typedef {Object} ServerConfig
 * @property {string} guild_id
 * @property {string|null} reaction_log_channels_id
 */
const ServerConfig = sequelize.define('ServerConfig', {
    guild_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    reaction_log_channels_id: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    }
}, {
    timestamps: true
});

/**
 * @async
 * @param {string} guildId
 * @returns {Promise<Object>}
 */
ServerConfig.findOrCreateConfig = async function(guildId) {
    const [config] = await ServerConfig.findOrCreate({
        where: { guild_id: guildId }
    });
    return config;
};

module.exports = ServerConfig;
