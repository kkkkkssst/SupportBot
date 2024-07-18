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
        let contactId = await getContactIdByTelegramId(userConnection.Id);
        let contact = await getContactById(contactId);
        let url = `${process.env.BASE_URL}/0/odata/Case`;
        let requestBody = JSON.stringify({ OriginId: "3d60121b-64c3-4410-a349-640554d58456", Symptoms: userConnection.appeal.description, Subject: userConnection.appeal.subject, ContactId: contact.Id, AccountId: contact.AccountId/*, telegramId: userConnection.Id, files: userConnection.appeal.files*/ });
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
        let caseData = {
            Id: response.data.Id,
            files: userConnection.appeal.files,
            createdById: contactId
        }
        await createCaseFile(caseData);
        userConnection.appeal = {};
        return response.data.Number;
    } catch (err) {
        console.error(err)
    }
}
async function createCaseFile(caseData) {
    try {
        let url = `${process.env.BASE_URL + process.env.SUPPORT_BOT_SERVICE_URL}/SetCaseFiles`;
        let requestBody = JSON.stringify({ caseId: caseData.caseId, files: caseData.files, createdById: caseData.createdById });
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
        return response.data;
    } catch (err) {
        console.error(err)
    }
}
async function getContactIdByTelegramId(telegramId) {
    try {
        let url = `${process.env.BASE_URL + process.env.SUPPORT_BOT_SERVICE_URL}/GetContactIdByTelegramId`;
        let requestBody = JSON.stringify({ telegramId: telegramId });
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
            statesCollection.push(item);
        });
        return statesCollection;
    } catch (err) {
        console.error(err)
    }
}
async function getCase(Id) {
    try {
        let url = process.env.BASE_URL + `/0/odata/Case(${Id})`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },

        }
        let response = await axios.get(url, requestOptions);
        return response.data;
    } catch (err) {
        console.error(err)
    }
}
async function getContacts() {
    try {
        let url = process.env.BASE_URL + `/0/odata/Contact`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },

        }
        let response = await axios.get(url, requestOptions);
        return response.data;
    } catch (err) {
        console.error(err)
    }
}
async function getContactById(Id) {
    try {
        let url = process.env.BASE_URL + `/0/odata/Contact(${Id})`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },

        }
        let response = await axios.get(url, requestOptions);
        return response.data;
    } catch (err) {
        console.error(err)
    }
}
async function createComment(userConnection) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/SocialMessage`;
        let requestBody = JSON.stringify({ EntityId: userConnection.case.caseId, EntitySchemaUId: "117d32f9-8275-4534-8411-1c66115ce9cd", Message: userConnection.case.message, CreatedById: userConnection.case.senderId });
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
        //userConnection.case = {}
        return response.status == 201;
    } catch (err) {
        console.error(err);
    }
}
async function getActiveUser(telegramId) {
    try {
        let user = {};
        let url = `${process.env.BASE_URL}/0/odata/UsrActiveUsersInSupportBot`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        if (response.data) {
            user = response.data.value.filter(d => d.UsrTelegramId == telegramId)[0];
        }
        return user;
    } catch (err) {
        console.error(err);
    }
}
async function createActiveUser(userConnection) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/UsrActiveUsersInSupportBot`;
        let requestBody = JSON.stringify({ UsrTelegramId: userConnection.Id.toString(), UsrStatus: userConnection.status });
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
        return response.status == 201;
    } catch (err) {
        console.error(err);
    }
}
async function getMessagesByCaseId(caseId) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/SocialMessage?%24filter=EntityId%20eq%20${caseId}`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        return response.data.value;
    } catch (err) {
        console.error(err);
    }
}
async function getEntityById(entityName, Id) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/${entityName}(${Id})`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        return response.data;
    } catch (err) {
        console.error(err);
    }
}
async function closeCase(Id) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/Case(${Id})`;
        let requestBody = JSON.stringify({ StatusId: "3e7f420c-f46b-1410-fc9a-0050ba5d6c38" });
        let requestOptions = {
            method: 'PATCH',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody
        }
        let response = await axios.patch(url, requestBody, requestOptions);
        return response.status == 204;
    } catch (err) {
        console.error(err);
    }
}
async function getCaseByNumber(number) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/Case?%24filter=contains(Number%2C%27${number}%27)`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        return response.data.value;
    } catch (err) {
        console.error(err);
    }
}
async function getContactCases(contactId) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/Case?%24filter=Contact%2FId%20eq%20${contactId}`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        return response.data.value;
    } catch (err) {
        console.error(err);
    }
}
async function setSatisfactionLevel(satisfactionLevelId, caseId) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/Case(${caseId})`;
        let requestBody = JSON.stringify({ SatisfactionLevelId: satisfactionLevelId });
        let requestOptions = {
            method: 'PATCH',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody
        }
        let response = await axios.patch(url, requestBody, requestOptions);
        return response.status == 204;
    } catch (err) {
        console.error(err);
    }
}
async function getSatisfactionLeveId(number) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/SatisfactionLevel`;
        let requestOptions = {
            method: 'GET',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            }
        }
        let response = await axios.get(url, requestOptions);
        return response.data.value.filter(v => v.Point.toString() === number)[0].Id;
    } catch (err) {
        console.error(err);
    }
}
async function setFeedback(comment, caseId) {
    try {
        let url = `${process.env.BASE_URL}/0/odata/Case(${caseId})`;
        let requestBody = JSON.stringify({ SatisfactionLevelComment: comment });
        let requestOptions = {
            method: 'PATCH',
            headers: {
                'Cookie': cookies.join('; '),
                'BPMCSRF': BPMCSRF,
                'Content-Type': 'application/json',
            },
            data: requestBody
        }
        let response = await axios.patch(url, requestBody, requestOptions);
        return response.status == 204;
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
    createComment,
    getCase,
    getContacts,
    getContactById,
    getActiveUser,
    createActiveUser,
    getMessagesByCaseId,
    closeCase,
    getCaseByNumber,
    getContactIdByTelegramId,
    getContactCases,
    setSatisfactionLevel,
    getSatisfactionLeveId,
    setFeedback,
    createCaseFile,
    getEntityById
};