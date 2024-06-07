const axios = require('axios');
const path = require('path');

let cookies;
let BPMCSRF;

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

module.exports = {
    authorization,
    getShadowAuthData,
    getUserByPhone,
    setContactData,
    createCase,
    getUserCases,
    getCaseStates
};