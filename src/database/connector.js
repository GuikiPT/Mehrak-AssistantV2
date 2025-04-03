/**
 * @module database/connector
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const colors = require('colors/safe');

/**
 * @type {Sequelize}
 */
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.db'),
    logging: false,
});

/**
 * @async
 * @returns {Promise<boolean>}
 */
async function initDatabase() {
    try {
        await sequelize.authenticate();
        console.log(colors.green('Connection has been established successfully.'));       
        return true;
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        return false;
    }
}

module.exports = {
    sequelize,
    initDatabase
};
