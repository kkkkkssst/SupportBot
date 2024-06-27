const axios = require('axios');
const path = require('path');

let cookies;
let BPMCSRF;

async function authorization() {
    let loginUrl = process.env.BASE_URL + process.env.LOGIN_URL;
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
        });

}
async function getShadowAuthData(userConnection) {
    try {
        const dataUrl = `${process.env.BASE_URL + process.env.AUTHORIZATION_SERVICE_URL}/GetContactByUserId`;
        const requestBody = JSON.stringify({ userId: userConnection.Id });
        const requestOptions = {
            method: 'POST',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        };
        const response = await axios.post(dataUrl, requestBody, requestOptions);
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error status:', response.status);
        }
    } catch (error) {
        console.error('Error during request:', error);
    }
}
async function getUserByPhone(userConnection) {
    try {
        const requestBody = JSON.stringify({ phoneNumber: userConnection.phoneNumber });
        let response = await fetch(`${process.env.BASE_URL + process.env.AUTHORIZATION_SERVICE_URL}/GetContactByPhoneNumber`, {
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
            console.error('Error status:', response.status);
        }
    } catch (error) {
        console.log(error);
    }


}
async function setContactData(userConnection) {
    try {
        const requestBody = JSON.stringify({ userId: userConnection.Id, phoneNumber: userConnection.phoneNumber });
        let response = await fetch(`${process.env.BASE_URL}/0/rest/BotService/SetContactData`, {
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
        let url = `${process.env.BASE_URL + process.env.SUPPORT_BOT_SERVICE_URL}/CreateCase`;
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
        console.error(err)
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
        console.error(err)
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
        console.error(err)
    }
}
async function createComment(userConnection) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/SocialMessage`;
        let requestBody = JSON.stringify({ EntityId: userConnection.case.caseId, EntitySchemaUId: "117d32f9-8275-4534-8411-1c66115ce9cd", Message: userConnection.case.message});
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
        userConnection.case = {}
        return response.status == 201;
    } catch (err) {
        console.error(err);
    }
}

module.exports = {
    authorization,
    getShadowAuthData,
    getUserByPhone,
    setContactData,
    createCase,
    getUserCases,
    getCaseStates,
    createComment
};