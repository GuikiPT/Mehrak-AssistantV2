const { Sequelize } = require('sequelize');
const path = require('path');
const colors = require('colors/safe');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.db'),
    logging: false,
});

async function initDatabase() {
    try {
        await sequelize.authenticate();
        console.log(colors.green('Connection has been established successfully.'));
        return true;
    } catch (error) {
        console.error(colors.red('Unable to connect to the database:'), error);
        return false;
    }
}

module.exports = {
    sequelize,
    initDatabase
};
