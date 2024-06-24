require('dotenv').config();

const Cookies = require('js-cookie');
const TelegramBot = require('node-telegram-bot-api');
const PrivateMessageHandler = require('./handlers/privateMessageHandler');
const GroupMessageHandler = require('./handlers/groupMessageHandler');
const { authorization, getShadowAuthData, getUserByPhone, setContactData, createCase, getUserCases, getCaseStates } = require('./apiService');

const bot = new TelegramBot(process.env.BOTKEY, {
    polling: {
        interval: 300,
        autoStart: true
    }
});

const commands = [{
    command: "start",
    description: "Запуск бота💫"
},
{
    command: "menu",
    description: "Меню🔎"
},
{
    command: "cancel",
    description: "Скасувати❌"
},

];

let userConnections = {};
let handler;

const setAuthorization = async () => {
    await authorization();
    setInterval(async () => {
        try {
            await authorization();
        } catch (error) {
            console.log(error);
        }
    }, 10 * 60 * 60 * 1000);
}

const start = () => {
    try {
        bot.setMyCommands(commands);
        bot.on('message', (msg) => {
            if (msg.chat.type === 'group') {
                handler = new GroupMessageHandler();
            } else if (msg.chat.type === 'private') {
                handler = new PrivateMessageHandler();
            }
        });
        bot.on('text', async msg => {
            await handler.handleText(bot, msg, userConnections);
        });
        bot.on('contact', async msg => {
            await handler.handleContact(bot, msg, userConnections);
        });
        bot.on('callback_query', async msg => {
            await handler.handleCallbackQuery(bot, msg, userConnections);
        });
        bot.on(`document`, async msg => {
            await handler.handleDocument(bot, msg, userConnections);
        });
        bot.on('photo', async msg => {
            await handler.handlePhoto(bot, msg, userConnections);
        });
    } catch (error) {
        console.error(error);
    }
}

setAuthorization();
start();