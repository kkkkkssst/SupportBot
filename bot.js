require('dotenv').config();

const Cookies = require('js-cookie');
const TelegramBot = require('node-telegram-bot-api');
const PrivateMessageHandler = require('./handlers/privateMessageHandler');
const GroupMessageHandler = require('./handlers/groupMessageHandler');
const { authorization, getShadowAuthData, getUserByPhone, setContactData, createCase, getUserCases, getCaseStates, getActiveUser, createActiveUser } = require('./apiServices');

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
    command: "info",
    description: "Інформаціяℹ️"
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
        bot.on('message', async msg => {
            if (msg.chat.type === 'group') {
                handler = new GroupMessageHandler();
            } else if (msg.chat.type === 'private') {
                handler = new PrivateMessageHandler();
            }
        });
        bot.on('text', async msg => {
            if (!userConnections[msg.chat.id]) {
                if (msg.chat.type === 'private') {
                    let user = await getActiveUser(msg.chat.id);
                    if (user) {
                        userConnections[msg.chat.id] = {
                            Id: Number(user.UsrTelegramId),
                            status: user.UsrStatus
                        }
                    } else {
                        //createActiveUser(userConnections[msg.chat.id]);
                    }
                } else if (msg.chat.type === 'group' && !userConnections[msg.from.id]) {

                    let user = await getActiveUser(msg.from.id);
                    if (user) {
                        userConnections[msg.from.id] = {
                            Id: Number(user.UsrTelegramId),
                            status: user.UsrStatus
                        }
                    } else {
                        //createActiveUser(userConnections[msg.from.id]);
                    }

                }
            }
            await handler.handleText(bot, msg, userConnections);
        });
        bot.on('contact', async msg => {
            await handler.handleContact(bot, msg, userConnections);
        });
        bot.on('callback_query', async msg => {
            if (msg.message.chat.type === 'group') {
                handler = new GroupMessageHandler();
                if (!userConnections[msg.from.id]) {
                    let user = await getActiveUser(msg.from.id);
                    if (user) {
                        userConnections[msg.from.id] = {
                            Id: Number(user.UsrTelegramId),
                            status: user.UsrStatus
                        }
                    } else {
                        //createActiveUser(userConnections[msg.from.id]);
                    }
                }
            } else if (msg.message.chat.type === 'private') {
                if (!userConnections[msg.message.chat.id]) {
                    let user = await getActiveUser(msg.message.chat.id);
                    if (user) {
                        userConnections[msg.message.chat.id] = {
                            Id: Number(user.UsrTelegramId),
                            status: user.UsrStatus
                        }
                    } else {
                        //createActiveUser(userConnections[msg.message.chat.id]);
                    }
                }
                handler = new PrivateMessageHandler();
            }
            if (handler)
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