const path = require('path');
const MessageHandler = require('./messageHandler');
const { getShadowAuthData, getUserByPhone, setContactData, getContactIdByTelegramId, getActiveUser, createActiveUser, createCase, getUserCases, getCaseStates, createComment } = require('../apiServices');
class GroupMessageHandler extends MessageHandler {
    static menuKeyboard = [[{ text: 'Додати новий кейс🆕', callback_data: 'AddNewCase'}], [{ text: 'Мої кейси📎', callback_data: "GetMyCases"}]];
    async handleText(bot, msg, userConnections) {
        if (msg.text === "/start" || msg.text === "/start@CRM_Genesis_Support_bot") {
            userConnections[msg.from.id] = {
                Id: msg.from.id
            }
            await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.from.first_name} !👋🏻`,{
                reply_markup: null
            });
            let authResult;
            authResult = await getShadowAuthData(userConnections[msg.from.id]);
            if (authResult === "access denied") {
                await bot.sendMessage(msg.chat.id, 'Пройдіть авторизацію в боті');
                await bot.sendMessage(msg.from.id, 'Для авторизації надайте Ваш номер телефону 📲', {
                    reply_markup: {
                        keyboard: [
                            [{ text: "Відправити номер телефону 📲", request_contact: true }]
                        ]
                    }
                });
            } else if (authResult === "access allowed") {
                let user = await getActiveUser(msg.from.id);
                if (!user) {
                    await createActiveUser(userConnections[msg.chat.id]);
                }
                await bot.sendMessage(msg.chat.id, `Авторизацію успішно пройдено✅`);
            }
        } else if (!userConnections[msg.from.id]) {
            await bot.sendMessage(msg.chat.id, `${msg.from.first_name} для доступу до функціоналу бота необхідно авторизуватись. ❌`);
            return;
        } else if (msg.text === "/menu" || msg.text === "/menu@CRM_Genesis_Support_bot" && (userConnections[msg.from.id] && userConnections[msg.from.id].status > 0 )) {
            /*await bot.sendMessage(msg.chat.id, "Меню🔎", {
                reply_markup: {
                    inline_keyboard: GroupMessageHandler.menuKeyboard,
                    resize_keyboard: true
                }
            });*/
            userConnections[msg.from.id].status = 1;
        } else if (msg.from.id && !userConnections[msg.from.id]) {
            return;
        } else if (userConnections[msg.from.id].status == 6) {
            userConnections[msg.from.id].case.message = msg.text;
            userConnections[msg.from.id].case.senderId = await getContactIdByTelegramId(msg.from.id);
            let result = await createComment(userConnections[msg.from.id]);
            if (result) {
                await bot.sendMessage(msg.chat.id, `Повідомлення успішно відправлено ✅ `);
            }
        }
    }
    async handleCallbackQuery(bot, msg, userConnections) {
        if (!userConnections[msg.from.id] || !userConnections[msg.from.id].status) {
            return;
        } else if (msg.data.startsWith("AddComment")) {
            userConnections[msg.from.id].case = JSON.parse(msg.data.replace("AddComment", ""));
            await bot.sendMessage(msg.message.chat.id, "Введіть повідомлення✍️");
            userConnections[msg.from.id].status = 6;
        } 
    }
    async handleDocument(bot, msg, userConnections) {
        if (!userConnections[msg.from.id] || !userConnections[msg.from.id].status) {
            return;
        } else if (userConnections[msg.from.id].status == 3) {
            let file = {};
            file.file_url = await bot.getFileLink(msg.document.file_id);
            file.file_name = msg.document.file_name;
            userConnections[msg.from.id].appeal.files.push(file);
            let simulatedMessage = {
                chat: msg.chat,
                from: msg.from,
                text: 'ready',
            };
            if (!userConnections[msg.from.id].appeal.documentFlag) {
                userConnections[msg.from.id].appeal.documentFlag = true;
                setTimeout(function () {
                    bot.emit('text', simulatedMessage);
                }, 3000);
                userConnections[msg.from.id].status = 4;
            }

        }
    }
    async handlePhoto(bot, msg, userConnections) {
        if (!userConnections[msg.from.id] || !userConnections[msg.from.id].status) {
            return;
        } else if (userConnections[msg.from.id].status === 3) {
            let file = {};
            file.file_url = await bot.getFileLink(msg.photo[0].file_id);
            file.file_name = path.basename(file.file_url);
            userConnections[msg.from.id].appeal.files.push(file);

            let simulatedMessage = {
                chat: msg.chat,
                from: msg.from,
                text: 'ready',
            };
            if (!userConnections[msg.from.id].appeal.documentFlag) {
                userConnections[msg.from.id].appeal.documentFlag = true;
                setTimeout(function () {
                    bot.emit('text', simulatedMessage);
                }, 3000);
                userConnections[msg.from.id].status = 4;
            }
        }

    }
    async handleContact(bot, msg, userConnections) {
    }
}

module.exports = GroupMessageHandler;