const path = require('path');
const MessageHandler = require('./messageHandler');
const { getShadowAuthData, getUserByPhone, setContactData, createCase, getUserCases, getCaseStates, createComment } = require('../apiService');
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
                await bot.sendMessage(msg.chat.id, `Авторизацію успішно пройдено✅`);
                await bot.sendMessage(msg.chat.id, `Меню бота🔎`, {
                    reply_markup: {
                        inline_keyboard: GroupMessageHandler.menuKeyboard,
                        resize_keyboard: true
                    }
                });
                userConnections[msg.from.id].status = 1;
            }
        } else if (!userConnections[msg.from.id] || !userConnections[msg.from.id].status) {
            await bot.sendMessage(msg.chat.id, `${msg.from.first_name} для доступу до функціоналу бота необхідно авторизуватись. ❌`);
            return;
        } else if (msg.text === "/menu" || msg.text === "/menu@CRM_Genesis_Support_bot" && (userConnections[msg.from.id] && userConnections[msg.from.id].status > 0 )) {
            await bot.sendMessage(msg.chat.id, "Меню🔎", {
                reply_markup: {
                    inline_keyboard: GroupMessageHandler.menuKeyboard,
                    resize_keyboard: true
                }
            });
            userConnections[msg.from.id].status = 1;
        } else if (msg.from.id && !userConnections[msg.from.id]) {
            return;
        } else if (msg.text === "/cancel") {
            userConnections[msg.chat.id].status = 0;
            await bot.sendMessage(msg.chat.id, "Дію скасовано♻️", {
                reply_markup: {

                    remove_keyboard: true
                }
            });
        } else if (userConnections[msg.from.id].status === 2) {
            userConnections[msg.from.id].appeal = {
                subject: msg.text,
                files: []
            }
            await bot.sendMessage(msg.chat.id, `Опишіть Вашу проблему🎯`);
            userConnections[msg.from.id].status = 3;
        } else if (userConnections[msg.from.id].status === 3) {
            if (userConnections[msg.from.id].appeal) {
                userConnections[msg.from.id].appeal.description = msg.text;
            }
            await bot.sendMessage(msg.chat.id, `Чи потрібно додати до звернення файл(скріншот, документ, тощо)?📄`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{ text: "Так", callback_data: "AcceptAddingDocument" },
                        { text: "Ні", callback_data: "DeclineAddingDocument" }],
                    ]
                })
            });
        } else if (userConnections[msg.from.id].status === 4) {
            let appealNum = await createCase(userConnections[msg.from.id]);
            await bot.sendMessage(msg.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);
        } else if (userConnections[msg.from.id].status == 6) {
            userConnections[msg.from.id].case.message = msg.text;
            let result = await createComment(userConnections[msg.from.id]);
            if (result) {
                await bot.sendMessage(msg.chat.id, `Повідомлення успішно відправлено ✅ `);
            }
        } else {
            await bot.sendMessage(msg.chat.id, `${msg.from.first_name}, я вас не зрозумів`);
        }
    }
    async handleCallbackQuery(bot, msg, userConnections) {
        if (!userConnections[msg.from.id] || !userConnections[msg.from.id].status) {
            return;
        }
        if (userConnections[msg.from.id].status == 1 && msg.data == "AddNewCase") {
            await bot.sendMessage(msg.message.chat.id, "Дайте назву зверненню 🖍");
            userConnections[msg.from.id].status = 2;
        } else if (userConnections[msg.from.id].status === 1 && msg.data == "GetMyCases") {
            let caseStates = await getCaseStates();
            let inline_keyboard = [];
            caseStates.forEach(async (item) => {
                inline_keyboard.push([{ text: item, callback_data: "Stage" + item }]);
            });
            await bot.sendMessage(msg.message.chat.id, "Виберіть статус кейсу ♻️", {
                reply_markup: {
                    inline_keyboard: inline_keyboard
                }
            });
            userConnections[msg.from.id].status = 5;
        } else if (userConnections[msg.from.id].status == 3 && msg.data == "AcceptAddingDocument") {
            await bot.sendMessage(msg.message.chat.id, `Надішліть документ 📃`);
        } else if (userConnections[msg.from.id].status == 3 && msg.data == "DeclineAddingDocument") {
            let appealNum = await createCase(userConnections[msg.from.id]);
            await bot.sendMessage(msg.message.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);
        } else if (userConnections[msg.from.id].status == 5) {
            if (!msg.data.startsWith('Stage')) {
                return;
            }
            msg.data = msg.data.replace('Stage', '');
            let cases = await getUserCases(userConnections[msg.from.id], msg.data);
            let inline_keyboard = [];
            cases.forEach(async (item) => {
                inline_keyboard.push([{ text: item, callback_data: item }]);
            });
            if (inline_keyboard.length > 0) {
                await bot.sendMessage(msg.message.chat.id, "Кейси зі статусом " + msg.data + " 🗓", {
                    reply_markup: JSON.stringify({
                        inline_keyboard: inline_keyboard
                    })
                });
            } else {
                await bot.sendMessage(msg.message.chat.id, "Кейси зі статусом " + msg.data + " відсутні ❌");
            }
        } else if (msg.data.startsWith("AddComment")) {
            //TODO ???
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