const path = require('path');
const MessageHandler = require('./messageHandler');
const { getShadowAuthData, getUserByPhone, setContactData, createCase, getUserCases, closeCase, getCaseStates, getCase, createComment, getContacts, getContactById, createActiveUser, getMessages } = require('../apiServices');
class PrivateMessageHandler extends MessageHandler {
    async handleText(bot, msg, userConnections) {
        if (msg.text === "/start" || msg.text === "/start@CRM_Genesis_Support_bot") {
            userConnections[msg.chat.id] = {
                Id: msg.chat.id
            }
            await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.chat.first_name} !👋🏻`, {
                remove_keyboard: true
            });
            let authResult = await getShadowAuthData(userConnections[msg.chat.id]);
            if (authResult === "access denied") {
                await bot.sendMessage(msg.chat.id, 'Для авторизації надайте Ваш номер телефону 📲', {
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
                        keyboard: [
                            ['Додати новий кейс🆕'],
                            ['Мої кейси📎']
                        ],
                        resize_keyboard: true
                    }
                });
                userConnections[msg.chat.id].status = 1;
            }
        } else if (!userConnections[msg.chat.id]) {
            return;
        } else if (msg.text === "/menu" || msg.text === 'Повернутись до меню ⬅️' || msg.text === "/menu@CRM_Genesis_Support_bot" && userConnections[msg.chat.id] && userConnections[msg.chat.id].status > 0) {
            await bot.sendMessage(msg.chat.id, "Меню🔎", {
                reply_markup: {
                    keyboard: [
                        ['Додати новий кейс🆕'],
                        ['Мої кейси📎']
                    ],
                    resize_keyboard: true
                }
            });
            userConnections[msg.chat.id].status = 1;
        } else if (msg.text === "/cancel") {
            userConnections[msg.chat.id].status = 0;
            await bot.sendMessage(msg.chat.id, "Дію скасовано♻️", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        } else if (!userConnections[msg.chat.id].status) {
            return;
        } else if (userConnections[msg.chat.id].status >= 1 && msg.text === "Додати новий кейс🆕") {
            await bot.sendMessage(msg.chat.id, "Дайте назву зверненню 🖍", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.chat.id].status = 2;
        } else if (userConnections[msg.chat.id].status >= 1 && msg.text === "Мої кейси📎") {
            let caseStates = await getCaseStates();
            let inline_keyboard = [[{ text: "Всі кейси", callback_data: "AllCases" + "" }], [{ text: "Пошук за номером", callback_data: "SearchNum" + "" }]];
            caseStates.forEach(async (item) => {
                inline_keyboard.push([{ text: item, callback_data: "Stage" + item }]);
            });
            await bot.sendMessage(msg.chat.id, "Виберіть тип кейсу ♻️", {
                reply_markup: {
                    inline_keyboard: inline_keyboard
                }
            });
            userConnections[msg.chat.id].status = 5;
        } else if (userConnections[msg.chat.id].status === 2) {
            userConnections[msg.chat.id].appeal = {
                subject: msg.text,
                files: []
            }
            await bot.sendMessage(msg.chat.id, `Опишіть Вашу проблему🎯`, {
                reply_markup: {

                }
            });
            userConnections[msg.chat.id].status = 3;
        } else if (userConnections[msg.chat.id].status === 3) {
            if (userConnections[msg.chat.id].appeal) {
                userConnections[msg.chat.id].appeal.description = msg.text;
            }
            await bot.sendMessage(msg.chat.id, `Чи потрібно додати до звернення файл(скріншот, документ, тощо)?📄`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{ text: "Так", callback_data: "AcceptAddingDocument" },
                        { text: "Ні", callback_data: "DeclineAddingDocument" }],
                    ]
                })
            });
        } else if (userConnections[msg.chat.id].status === 4) {
            let appealNum = await createCase(userConnections[msg.chat.id]);
            await bot.sendMessage(msg.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `, {
                reply_markup: {
                    keyboard: [
                        ['Повернутись до меню ⬅️']
                    ],
                    resize_keyboard: true
                }
            });
            userConnections[msg.chat.id].status == 1;
        } else if (userConnections[msg.from.id].status == 6) {
            userConnections[msg.from.id].case.message = msg.text;
            // TODO: maybe we can do better this functional
            let contacts = await getContacts();
            userConnections[msg.from.id].case.senderId = contacts.value.filter(c => c.UsrTelegramId == msg.from.id)[0].Id;
            let result = await createComment(userConnections[msg.from.id]);
            if (result) {
                await bot.sendMessage(msg.chat.id, `Повідомлення успішно відправлено ✅ `, {
                    reply_markup: {
                        keyboard: [
                            ['Повернутись до меню ⬅️']
                        ],
                        resize_keyboard: true
                    }
                });
            }
        }
    }
    async handleContact(bot, msg, userConnections) {
        await bot.sendMessage(msg.chat.id, 'Меню закрито❌', {
            reply_markup: {
                remove_keyboard: true
            }
        });

        if (userConnections[msg.chat.id] && msg.chat.id === userConnections[msg.chat.id].Id) {
            if (!msg.contact.phone_number.startsWith('+')) {
                userConnections[msg.chat.id].phoneNumber = "+" + msg.contact.phone_number;
            } else {
                userConnections[msg.chat.id].phoneNumber = msg.contact.phone_number;
            }
            let result = await getUserByPhone(userConnections[msg.chat.id]);

            if (!result || result === "access denied") {
                return bot.sendMessage(msg.chat.id, 'Доступ заборонено❌');
            }
            await bot.sendMessage(msg.chat.id, `Авторизацію успішно пройдено✅`);
            userConnections[msg.chat.id].status = 1;
            await setContactData(userConnections[msg.chat.id]);
            await bot.sendMessage(msg.chat.id, `Меню бота🔎`, {
                reply_markup: {
                    keyboard: [
                        ['Додати новий кейс🆕'],
                        ['Мої кейси📎']
                    ],
                    resize_keyboard: true
                }
            });
        }
    }
    async handleCallbackQuery(bot, msg, userConnections) {
        if (!userConnections[msg.message.chat.id] || !userConnections[msg.message.chat.id].status) {
            return;
        }
        if (userConnections[msg.message.chat.id].status == 3 && msg.data == "AcceptAddingDocument") {
            await bot.sendMessage(msg.message.chat.id, `Надішліть документ 📃`);
        } else if (userConnections[msg.message.chat.id].status == 3 && msg.data == "DeclineAddingDocument") {
            let appealNum = await createCase(userConnections[msg.message.chat.id]);
            await bot.sendMessage(msg.message.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `, {
                reply_markup: {
                    keyboard: [
                        ['Повернутись до меню ⬅️']
                    ],
                    resize_keyboard: true
                }
            });
            userConnections[msg.message.chat.id].status = 1;
        } else if (userConnections[msg.message.chat.id].status == 5) {
            if (!msg.data.startsWith('Stage')) {
                return;
            }
            msg.data = msg.data.replace('Stage', '');
            let cases = await getUserCases(userConnections[msg.message.chat.id], msg.data);
            let inline_keyboard = [];
            cases.forEach(async (item) => {
                inline_keyboard.push([{ text: item.Value, callback_data: item.Key }]);
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
            userConnections[msg.message.chat.id].status = 7;
        } else if (userConnections[msg.message.chat.id].status == 7) {
            let inline_keyboard = [];
            let example = await getCase(msg.data);
            if (!example) {
                return;
            }
            inline_keyboard.push([{ text: "Додати повідомлення", callback_data: "AddComment" + msg.data }], [{ text: "Закрити кейс", callback_data: "CloseCase" + msg.data }]);
            await bot.sendMessage(msg.message.chat.id, "📁 Кейс - " + example.Number + `\n\nНазва: ${example.Subject}\n\nПроблема: ${example.Symptoms}`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: inline_keyboard
                })
            });
            userConnections[msg.message.chat.id].status = 8;
        } else if (userConnections[msg.message.chat.id].status == 8 && msg.data.startsWith("AddComment") ) {
            userConnections[msg.from.id].case = {
                caseId: msg.data.replace("AddComment", ""),
            };
            await bot.sendMessage(msg.message.chat.id, "Введіть повідомлення✍️", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.message.chat.id].status = 6;
        } else if (msg.data.startsWith("CloseCase") ) {
            await closeCase(msg.data.replace("CloseCase", ""));
            await bot.sendMessage(msg.message.chat.id, "Кейс успішно закрито ❌");
        } else if (msg.data.startsWith("AddComment")) {
            //TODO ???
            userConnections[msg.from.id].case = JSON.parse(msg.data.replace("AddComment", ""));
            await bot.sendMessage(msg.message.chat.id, "Введіть повідомлення✍️");
            userConnections[msg.from.id].status = 6;
        } else if (msg.data.startsWith("DownloadCm")) {
            let messages = await getMessages();
            messages = messages.filter(m => m.EntityId === JSON.parse(msg.data.replace("DownloadCm", "")).caseId);
            messages.sort((a, b) => new Date(a.CreatedOn) - new Date(b.CreatedOn));
            let counter = (messages.length > 5) ? 5 : messages.length;
            for (let i = 0; i < counter; i++) {
                let contact = await getContactById(messages[i].CreatedById);
                await bot.sendMessage(msg.message.chat.id, `Відправник 👤: ${contact.Name}\n\nПовідомлення 📝: ${messages[i].Message}`);
            }
        }

    }
    async handleDocument(bot, msg, userConnections) {
        if (!userConnections[msg.chat.id] || !userConnections[msg.chat.id].status) {
            return;
        } else if (userConnections[msg.chat.id].status == 3) {
            let file = {};
            file.file_url = await bot.getFileLink(msg.document.file_id);
            file.file_name = msg.document.file_name;
            userConnections[msg.chat.id].appeal.files.push(file);
            let simulatedMessage = {
                chat: {
                    id: msg.chat.id,
                },
                text: 'ready',
            };
            if (!userConnections[msg.chat.id].appeal.documentFlag) {
                userConnections[msg.chat.id].appeal.documentFlag = true;
                setTimeout(function () {
                    bot.emit('text', simulatedMessage);
                }, 3000);
                userConnections[msg.chat.id].status = 4;
            }

        }
    }
    async handlePhoto(bot, msg, userConnections) {
        if (!userConnections[msg.chat.id] || !userConnections[msg.chat.id].status) {
            return;
        } else if (userConnections[msg.chat.id].status === 3) {
            let file = {};
            file.file_url = await bot.getFileLink(msg.photo[0].file_id);
            file.file_name = path.basename(file.file_url);
            userConnections[msg.chat.id].appeal.files.push(file);

            let simulatedMessage = {
                chat: {
                    id: msg.chat.id,
                },
                text: 'ready',
            };
            if (!userConnections[msg.chat.id].appeal.documentFlag) {
                userConnections[msg.chat.id].appeal.documentFlag = true;
                setTimeout(function () {
                    bot.emit('text', simulatedMessage);
                }, 3000);
                userConnections[msg.chat.id].status = 4;
            }
        }

    }
}

module.exports = PrivateMessageHandler;