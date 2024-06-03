require('dotenv').config();

const axios = require('axios');
const Cookies = require('js-cookie');
const TelegramBot = require('node-telegram-bot-api');

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
    command: "cancel",
    description: "Скасувати❌"
},

];

var userConnections = {};
var cookies;
var BPMCSRF;

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
                    //await bot.sendMessage(msg.chat.id, `Вітаю всіх учасників групи!👋🏻\nGroup Id ${msg.chat.id}`);
                    userConnections[msg.chat.id] = {
                        Id: msg.from.id
                    }
                    await bot.sendMessage(msg.chat.id, `Вітаю, ${msg.from.first_name} !👋🏻`);
                }
                else if (msg.chat.type === 'private') {
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
                                ]
                            }

                        });
                        userConnections[msg.chat.id].status = 1;
                    }
                }
            } else if (userConnections[msg.chat.id] && msg.text === "/cancel") {
                userConnections[msg.chat.id].status = 0;
                await bot.sendMessage(msg.chat.id, "Дію скасовано♻️");
            } else if (userConnections[msg.chat.id] && msg.text === "Додати новий кейс🆕") {
                await bot.sendMessage(msg.chat.id, "Дайте назву зверненню 🖍", {
                    reply_markup: {
                        force_reply: true,
                    }
                });
                userConnections[msg.chat.id].status = 2;
            } else if (userConnections[msg.chat.id] && userConnections[msg.chat.id].status === 2) {
                userConnections[msg.chat.id].appeal = {
                    subject: msg.text
                }
                await bot.sendMessage(msg.chat.id, `Опишіть Вашу проблему🎯`, {
                    reply_markup: {
                        force_reply: true,
                    }
                });
                userConnections[msg.chat.id].status = 3;
            } else if (userConnections[msg.chat.id] && userConnections[msg.chat.id].status == 3) {
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
                        ]
                    }
                });
            }
        });
        bot.on('callback_query', async msg => {
            if (!Object.keys(userConnections).length > 0) {
                return;
            }
            if (userConnections[msg.message.chat.id].status == 3 && msg.data == "AcceptAddingDocument") {
                await bot.sendMessage(msg.message.chat.id, `Надішліть документ 📃`, {
                    reply_markup: {
                        force_reply: true
                    }
                });
                userConnections[msg.message.chat.id].status = 4;
            } else if (userConnections[msg.message.chat.id].status == 3 && msg.data == "DeclineAddingDocument") {
                let appealNum = await createCase(userConnections[msg.message.chat.id]);
                await bot.sendMessage(msg.message.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);
            }

        });
        bot.on(`document`, async msg => {
            if (Object.keys(userConnections).length > 0) {
                if (userConnections[msg.chat.id].status == 3) {
                    await bot.sendMessage(msg.chat.id, `Документ прийнято!✅`);
                    userConnections[msg.chat.id].appeal.file = {}

                    userConnections[msg.chat.id].appeal.file.file_url = await bot.getFileLink(msg.document.file_id);
                    userConnections[msg.chat.id].appeal.file.file_name = msg.document.file_name;

                    let appealNum = await createCase(userConnections[msg.chat.id]);
                    await bot.sendMessage(msg.chat.id, `Звернення успішно оформлено під номером ${appealNum}!✅ `);

                }
            }
        });
    } catch (error) {
        console.log(error);
    }
}
async function authorization() {

    var loginUrl = process.env.LOGIN_URL;
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
        let requestBody = JSON.stringify({ description: userConnection.appeal.description, subject: userConnection.appeal.subject,telegramId: userConnection.Id, file: userConnection.appeal.file, source: "SupportBot"});
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

setAuthorization();
start();