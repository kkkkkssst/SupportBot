const path = require('path');
const MessageHandler = require('./messageHandler');
const { getShadowAuthData, getUserByPhone, setContactData, createCase, getActiveUser,createActiveUser, setSatisfactionLevel, getUserCases, closeCase, setFeedback, getContactCases, getCaseByNumber, getCaseStates, getCase, createComment, getContacts, getContactById, getMessagesByCaseId, getContactIdByTelegramId, getSatisfactionLeveId } = require('../apiServices');
class PrivateMessageHandler extends MessageHandler {
    async handleText(bot, msg, userConnections) {
        if (msg.text === "/start" || msg.text === "/start@CRM_Genesis_Support_bot") {
            userConnections[msg.chat.id] = {
                Id: msg.chat.id
            }
            await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.chat.first_name} !👋🏻`, {
                reply_markup: {
                    remove_keyboard: true
                }
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
                let user = await getActiveUser(msg.chat.id);
                if (!user) {
                    await createActiveUser(userConnections[msg.chat.id]);
                }
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
            let inline_keyboard = [[{ text: "Всі кейси", callback_data: "GetAllCases" }], [{ text: "Пошук за номером", callback_data: "SearchNum" }]];
            caseStates.forEach(async (item) => {
                inline_keyboard.push([{ text: item.Name, callback_data: "Stage" + item.Name}]);
            });
            await bot.sendMessage(msg.chat.id, "Виберіть тип кейсу ♻️", {
                reply_markup: {
                    inline_keyboard: inline_keyboard
                }
            });
            userConnections[msg.chat.id].lastDate = undefined;
            userConnections[msg.chat.id].lastDateIndex = undefined;
            userConnections[msg.chat.id].lastDateCounter = undefined;
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
        } else if (userConnections[msg.chat.id].status == 6) {
            userConnections[msg.chat.id].case.message = msg.text;
            // TODO: maybe we can do better this functional
            let contacts = await getContacts();
            userConnections[msg.chat.id].case.senderId = contacts.value.filter(c => c.UsrTelegramId == msg.chat.id)[0].Id;
            let result = await createComment(userConnections[msg.chat.id]);
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
        } else if (userConnections[msg.chat.id].status == 9) {
            let example = await getCaseByNumber(msg.text);
            let currentContactId = await getContactIdByTelegramId(msg.chat.id);
            let contactInCase = example[0].ContactId;
            if (!example[0] || (currentContactId != contactInCase)) {
                await bot.sendMessage(msg.chat.id, `📁 Кейс за номером ${msg.text} не знайдено`, {
                    reply_markup: {
                        keyboard: [
                            ['Повернутись до меню ⬅️']
                        ],
                        resize_keyboard: true
                    }
                });
                return;
            }
            let inline_keyboard = [];
            let caseInfo = {
                caseId: example[0].Id 
            }
            inline_keyboard.push([{ text: "Додати повідомлення", callback_data: "AddBComm" + example[0].Id }], [{ text: "Показати повідомлення", callback_data: "DownloadCm" + JSON.stringify(caseInfo)}]);
            if (!this.caseStatusesIgnoreList.includes(example[0].StatusId)) {
                inline_keyboard.push([{ text: "Закрити кейс", callback_data: "CloseCase" + example[0].Id }]);
            }
            await bot.sendMessage(msg.chat.id, "📁 Кейс - " + example[0].Number + `\n\nНазва: ${example[0].Subject}\n\nПроблема: ${example[0].Symptoms}`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: inline_keyboard
                })
            });
        } else if (userConnections[msg.chat.id].status == 10) {
            await setFeedback(msg.text, userConnections[msg.chat.id].case.Id);
            await bot.sendMessage(msg.chat.id, "Дякуємо за Ваш відгук ✅\nВін допоможе нам покращити якість обслуговування");
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
        } else if (msg.data.startsWith('Stage')) {
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
        } else if (msg.data.startsWith('SearchNum')) {
            await bot.sendMessage(msg.message.chat.id, "Введіть номер кейсу🖊", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.message.chat.id].status = 9;
        } else if (msg.data.startsWith("AddBComm")) {
            userConnections[msg.from.id].case = {
                caseId: msg.data.replace("AddBComm", ""),
            };
            await bot.sendMessage(msg.message.chat.id, "Введіть повідомлення✍️", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.message.chat.id].status = 6;
        } else if (msg.data.startsWith("CloseCase")) {
            await closeCase(msg.data.replace("CloseCase", ""));
            await bot.sendMessage(msg.message.chat.id, "Кейс успішно закрито ❌", {
                reply_markup: {
                    keyboard: [
                        ['Повернутись до меню ⬅️']
                    ],
                    resize_keyboard: true
                }
            });
        } else if (msg.data.startsWith("AddComment")) {
            //TODO ???
            userConnections[msg.from.id].case = JSON.parse(msg.data.replace("AddComment", ""));
            await bot.sendMessage(msg.message.chat.id, "Введіть повідомлення✍️", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.from.id].status = 6;
        } else if (msg.data.startsWith("DownloadCm")) {
            let messages = await getMessagesByCaseId(JSON.parse(msg.data.replace("DownloadCm", "")).caseId);
            if (messages.length === 0) {
                await bot.sendMessage(msg.message.chat.id, "Повідомлення в цьому кейсі відсутні 💤", {
                    reply_markup: {
                        keyboard: [
                            ['Повернутись до меню ⬅️']
                        ],
                        resize_keyboard: true
                    }
                });
                return;
            }
            messages.sort((a, b) => new Date(b.CreatedOn) - new Date(a.CreatedOn));
            let messagesLength = (messages.length > 5) ? 5 : messages.length;
            let counter = (!userConnections[msg.message.chat.id].lastCommentCounter) ? messagesLength : userConnections[msg.message.chat.id].lastCommentCounter;
            if (!userConnections[msg.message.chat.id].lastCommentIndex) {
                userConnections[msg.message.chat.id].lastCommentIndex = 0;
            }
            if (!userConnections[msg.message.chat.id].lastCommentCounter) {
                userConnections[msg.message.chat.id].lastCommentCounter = 5;
            }
            for (let i = userConnections[msg.message.chat.id].lastCommentIndex; i < counter + userConnections[msg.message.chat.id].lastCommentIndex; i++) {
                let inline_keyboard = [];
                let contact = await getContactById(messages[i].CreatedById);
                if (i === counter - 1 && counter >= 5) { 
                    inline_keyboard.push([{ text: "Показати ще", callback_data: msg.data}])
                }
                await bot.sendMessage(msg.message.chat.id, `Відправник 👤: ${contact.Name}\n\nПовідомлення 📝:\n${messages[i].Message}`, {
                    reply_markup: JSON.stringify({
                        inline_keyboard: inline_keyboard
                    })
                });
                if (i === counter - 1) {
                    break;
                }
            }
            /*for (let i = 0; i < counter; i++) {
                let inline_keyboard = [];
                let contact = await getContactById(messages[i].CreatedById);
                if (i === counter - 1 && counter >= 5) { 
                    inline_keyboard.push([{ text: "Показати ще", callback_data: msg.data}])
                }
                await bot.sendMessage(msg.message.chat.id, `Відправник 👤: ${contact.Name}\n\nПовідомлення 📝:\n${messages[i].Message}`, {
                    reply_markup: JSON.stringify({
                        inline_keyboard: inline_keyboard
                    })
                });
            }*/
        } else if (msg.data.startsWith("GetAllCases")) {
            let currentContactId = await getContactIdByTelegramId(msg.message.chat.id);
            let cases = await getContactCases(currentContactId);
            if (userConnections[msg.message.chat.id].lastDate) {
                cases = cases.filter(c => new Date(c.CreatedOn) > new Date(userConnections[msg.message.chat.id].lastDate));
            }
            cases.sort((a, b) => new Date(a.CreatedOn) - new Date(b.CreatedOn));
            if (cases.length == 0) {
                await bot.sendMessage(msg.message.chat.id, "У вас ще немає кейсів 🧐", {
                    reply_markup: {
                        keyboard: [
                            ['Повернутись до меню ⬅️']
                        ],
                        resize_keyboard: true
                    }
                });
                return;
            }
            let casesLength = (cases.length > 5) ? 5 : cases.length;
            let counter = (!userConnections[msg.message.chat.id].lastDateCounter) ? casesLength : userConnections[msg.message.chat.id].lastDateCounter;
            if (!userConnections[msg.message.chat.id].lastDateIndex) {
                userConnections[msg.message.chat.id].lastDateIndex = 0;
            }
            if (!userConnections[msg.message.chat.id].lastDateCounter) {
                userConnections[msg.message.chat.id].lastDateCounter = 5;
            }
            for (let i = userConnections[msg.message.chat.id].lastDateIndex; i < counter + userConnections[msg.message.chat.id].lastDateIndex; i++) {
                let inline_keyboard = [];
                if (!cases[i]) { 
                    continue;
                }
                let caseInfo = {
                    caseId: cases[i].Id
                }
                inline_keyboard.push([{ text: "Додати повідомлення", callback_data: "AddBComm" + cases[i].Id }], [{ text: "Показати повідомлення", callback_data: "DownloadCm" + JSON.stringify(caseInfo)}]);
                if (!this.caseStatusesIgnoreList.includes(cases[i].StatusId)) {
                    inline_keyboard.push([{ text: "Закрити кейс", callback_data: "CloseCase" + cases[i].Id }]);
                }
                if (i === counter - 1 && counter >= 5) {
                    inline_keyboard.push([{ text: "Завантажити ще", callback_data: "GetAllCases"}]);
                    userConnections[msg.message.chat.id].lastDate = cases[0].CreatedOn;
                    userConnections[msg.message.chat.id].lastDateIndex = i + 1;
                    userConnections[msg.message.chat.id].lastDateCounter += 5;
                }
                await bot.sendMessage(msg.message.chat.id, "📁 Кейс - " + cases[i].Number + `\n\nНазва: ${cases[i].Subject}\n\nПроблема: ${cases[i].Symptoms}`, {
                    reply_markup: JSON.stringify({
                        inline_keyboard: inline_keyboard
                    })
                });
                if (i === counter - 1) {
                    break;
                }
            }
        } else if (msg.data.startsWith("ReviewMrk")) {
            let mark = msg.data.replace("ReviewMrk", "")[0];
            let caseId = JSON.parse(msg.data.replace("ReviewMrk", "").substring(1)).caseId;
            let satisfactionLevelId = await getSatisfactionLeveId(mark);
            await setSatisfactionLevel(satisfactionLevelId, caseId);
            await bot.sendMessage(msg.message.chat.id, "Дякуємо за Вашу оцінку ✅");
        } else if (msg.data.startsWith("ReviewComm")) {
            await bot.sendMessage(msg.message.chat.id, "📢 Будь ласка, опишіть якість отриманої технічної підтримки.\nВаш відгук дуже важливий для нас!", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            userConnections[msg.message.chat.id].case = {
                Id: JSON.parse(msg.data.replace("ReviewComm", "")).caseId
            };
            userConnections[msg.message.chat.id].status = 10;
        } else if (userConnections[msg.message.chat.id].status == 7) {
            let inline_keyboard = [];
            let example = await getCase(msg.data);
            if (!example) {
                return;
            }
            let caseInfo = {
                caseId: msg.data 
            }
            inline_keyboard.push([{ text: "Додати повідомлення", callback_data: "AddBComm" + msg.data }], [{ text: "Показати повідомлення", callback_data: "DownloadCm" + JSON.stringify(caseInfo)}]);
            if (!this.caseStatusesIgnoreList.includes(example.StatusId)) {
                inline_keyboard.push([{ text: "Закрити кейс", callback_data: "CloseCase" + msg.data }]);
            }
            await bot.sendMessage(msg.message.chat.id, "📁 Кейс - " + example.Number + `\n\nНазва: ${example.Subject}\n\nПроблема: ${example.Symptoms}`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: inline_keyboard
                })
            });
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

module.exports = PrivateMessageHandler