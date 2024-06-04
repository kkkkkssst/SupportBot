require('dotenv').config();

const axios = require('axios');
const Cookies = require('js-cookie');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const bot = new TelegramBot(process.env.BOTKEY, {
    polling: {
        interval: 300,
        autoStart: true
    }
});
bot.removeAllListeners("message");
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
let cookies;
let BPMCSRF;
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
        bot.on('text', async msg => {
            if (msg.text === "/start" || msg.text === "/start@CRM_Genesis_Support_bot") {
                if (msg.chat.type === 'group') {
                    userConnections[msg.chat.id] = {
                        Id: msg.from.id
                    }
                    await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.from.first_name} !👋🏻`);
                } else if (msg.chat.type === 'private') {
                    userConnections[msg.chat.id] = {
                        Id: msg.chat.id
                    }
                    await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.chat.first_name} !👋🏻`);
                }
                if (cookies && BPMCSRF) {
                    var authResult = await getShadowAuthData(userConnections[msg.chat.id]);
                    if (authResult === "access denied") {
                        await bot.sendMessage(msg.chat.id, 'Для авторизації надайте Ваш номер телефону 📲', {
                            reply_markup: {
                                keyboard: [
                                    [{ text: "Відправити номер телефону 📲", request_contact: true }]
                                ],
                                force_reply: true
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
                }
            } else if (msg.text === "/menu" || msg.text === "/menu@CRM_Genesis_Support_bot" && userConnections[msg.chat.id].status > 0) { 
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
            } else if (!userConnections[msg.chat.id] && userConnections[msg.chat.id].status > 0) {
                return;
            } else if (msg.text === "/cancel") {
                userConnections[msg.chat.id].status = 0;
                await bot.sendMessage(msg.chat.id, "Дію скасовано♻️");
            } else if (!userConnections[msg.chat.id].status) {
                return;
            } else if (userConnections[msg.chat.id].status === 1 && msg.text === "Додати новий кейс🆕") {
                await bot.sendMessage(msg.chat.id, "Дайте назву зверненню 🖍", {
                    reply_markup: {
                        force_reply: true,
                        remove_keyboard: true
                    }
                });
                userConnections[msg.chat.id].status = 2;
            } else if (userConnections[msg.chat.id].status === 1 && msg.text === "Мої кейси📎") {
                let caseStates = await getCaseStates();
                let inline_keyboard = [];
                caseStates.forEach(async (item) => {
                    inline_keyboard.push([{ text: item, callback_data: item }]);
                });
                await bot.sendMessage(msg.chat.id, "Виберіть статус кейсу ♻️", {
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
                        force_reply: true,
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
                await bot.sendMessage(msg.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);
            }
        });
        bot.on('contact', async msg => {
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

                await setContactData(userConnections[msg.chat.id]);

                await bot.sendMessage(msg.chat.id, `Меню бота🔎`, {
                    reply_markup: {
                        keyboard: [
                            ['Додати новий кейс🆕']
                            ['Мої кейси📎']
                        ],
                        resize_keyboard: true
                    }
                });
            }
        });
        bot.on('callback_query', async msg => {
            if (!userConnections[msg.message.chat.id] || !userConnections[msg.message.chat.id].status) {
                return;
            }
            if (userConnections[msg.message.chat.id].status == 3 && msg.data == "AcceptAddingDocument") {
                await bot.sendMessage(msg.message.chat.id, `Надішліть документ 📃`, {
                    reply_markup: {
                        force_reply: true
                    }
                });
                //userConnections[msg.message.chat.id].status = 4;
            } else if (userConnections[msg.message.chat.id].status == 3 && msg.data == "DeclineAddingDocument") {
                let appealNum = await createCase(userConnections[msg.message.chat.id]);
                await bot.sendMessage(msg.message.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);
            } else if (userConnections[msg.message.chat.id].status == 5) {
                let cases = await getUserCases(userConnections[msg.message.chat.id], msg.data);
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
            }

        });
        bot.on(`document`, async msg => {
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

        });
        bot.on('photo', async msg => {
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

        });
    } catch (error) {
        console.log(error);
    }
}
async function authorization() {

    var loginUrl = process.env.BASE_URL + process.env.LOGIN_URL;
    const authRequestBody = JSON.stringify({ UserName: process.env.LOGIN, UserPassword: process.env.PASSWORD });

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        data: authRequestBody,
    };

    axios.post(loginUrl, authRequestBody, requestOptions)
        .then(async (response) => {
            if (response.status === 200) {
                cookies = response.headers['set-cookie'];
                cookies.forEach(cookie => {
                    const matches = cookie.match(/BPMCSRF=([^;]+)/);
                    if (matches) {
                        BPMCSRF = matches[1];
                    }
                });
            } else {
                console.error('Authorization error ', response.status);
            }
        })
        .catch((error) => {
            console.error(error);
            reject(error);
        });

}
async function getShadowAuthData(userConnection) {
    return new Promise((resolve, reject) => {

        const dataUrl = "https://crmgenesis.creatio.com/0/rest/AuthorizationService/GetContactByUserId";

        const requestBody = JSON.stringify({ userId: userConnection.Id });

        const requestOptions = {
            method: 'POST',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody,
        };

        axios.post(dataUrl, requestBody, requestOptions)
            .then(async (response) => {
                if (response.status === 200) {
                    resolve(response.data);
                } else {
                    console.error('Error status:', response.status);
                    reject(response.status);
                }
            })
            .catch((error) => {
                console.error(error);
                reject(error);
            });
    });
}
async function getUserByPhone(userConnection) {
    try {
        const requestBody = JSON.stringify({ phoneNumber: userConnection.phoneNumber });

        let response = await fetch('https://crmgenesis.creatio.com/0/rest/AuthorizationService/GetContactByPhoneNumber', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF
            },
            body: requestBody
        });

        if (response.ok) {
            let result = await response.json();
            return result;
        } else {
            console.log(response.status);
            return;
        }

    } catch (error) {
        console.log(error);
    }


}
async function setContactData(userConnection) {
    try {
        const requestBody = JSON.stringify({ userId: userConnection.Id, phoneNumber: userConnection.phoneNumber });
        let response = await fetch("https://crmgenesis.creatio.com/0/rest/BotService/SetContactData", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF
            },
            body: requestBody
        });
    } catch (error) {
        console.log(error)
    }
}
async function createCase(userConnection) {
    try {
        let url = "https://crmgenesis.creatio.com/0/rest/SupportBotService/CreateCase";
        let requestBody = JSON.stringify({ description: userConnection.appeal.description, subject: userConnection.appeal.subject, telegramId: userConnection.Id, files: userConnection.appeal.files, source: "SupportBot" });
        let requestOptions = {
            method: 'POST',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody
        }
        let response = await axios.post(url, requestBody, requestOptions);
        userConnection.appeal = {}

        return response.data;
    } catch (err) {
        console.log(err)
    }
}
async function getUserCases(userConnection, status) {
    try {
        let url = process.env.BASE_URL + process.env.SUPPORT_BOT_SERVICE_URL + "/GetUserCases";
        let caseCollection = [];
        let requestBody = JSON.stringify({ telegramId: userConnection.Id, caseStatus: status });
        let requestOptions = {
            method: 'POST',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody
        }
        let response = await axios.post(url, requestBody, requestOptions);
        await response.data.forEach(async (item) => {
            caseCollection.push(item);
        });
        return caseCollection;
    } catch (err) {
        console.log(err)
    }
}
async function getCaseStates(userConnection) {
    try {
        let statesCollection = [];
        let url = process.env.BASE_URL + "/0/odata/CaseStatus";
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },

        }
        let response = await axios.get(url, requestOptions);
        await response.data.value.forEach(async (item) => {
            statesCollection.push(item.Name);
        });
        return statesCollection;
    } catch (err) {
        console.log(err)
    }
}


setAuthorization();
start();