/**
 * @module database/models/ServerConfig
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../connector');

/**
 * @typedef {Object} ServerConfig
 * @property {number} id
 * @property {string} guild_id
 * @property {string|null} reaction_log_channels_id
 */
const ServerConfig = sequelize.define('ServerConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    guild_id: {
        type: DataTypes.STRING,
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
