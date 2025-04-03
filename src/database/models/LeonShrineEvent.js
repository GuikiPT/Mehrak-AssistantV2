/**
 * @module database/models/LeonShrineEvent
 * @description Models for Leon Shrine Event tracking
 */
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../connector');

/**
 * Configuration for a Leon Shrine Event
 * @class LeonShrineEventConfig
 * @extends Model
 */
class LeonShrineEventConfig extends Model {
    /**
     * Find or create a configuration for a guild
     * @param {string} guildId - The Discord guild ID
     * @returns {Promise<LeonShrineEventConfig>} - The configuration object
     */
    static async findOrCreateConfig(guildId) {
        const [config] = await this.findOrCreate({
            where: { guild_id: guildId },
            defaults: {
                guild_id: guildId,
                role_id: null,
                channel_id: null,
                sticker_id: null,
                active: false
            }
        });
        return config;
    }
}

LeonShrineEventConfig.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    role_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    channel_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sticker_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'LeonShrineEventConfig',
    tableName: 'leon_shrine_event_configs',
    timestamps: true
});

/**
 * Users who participated in a Leon Shrine Event
 * @class LeonShrineEventUsers
 * @extends Model
 */
class LeonShrineEventUsers extends Model {}

LeonShrineEventUsers.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    event_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    addedToRole: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'LeonShrineEventUsers',
    tableName: 'leon_shrine_event_users',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['guild_id', 'user_id', 'event_id']
        }
    ]
});

module.exports = {
    LeonShrineEventConfig,
    LeonShrineEventUsers
};
