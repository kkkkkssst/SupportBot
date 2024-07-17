class MessageHandler {
    caseStatusesIgnoreList = ["3e7f420c-f46b-1410-fc9a-0050ba5d6c38", "6e5f4218-f46b-1410-fe9a-0050ba5d6c38"];
    handleText(bot, msg, userConnections) {
        throw new Error("This method should be overridden.");
    }
    handleContact(bot, msg, userConnections) {
        throw new Error("This method should be overridden.");
    }
    handleCallbackQuery(bot, msg, userConnections) {
        throw new Error("This method should be overridden.");
    }
    handleDocument(bot, msg, userConnections) {
        throw new Error("This method should be overridden.");
    }
    handlePhoto(bot, msg, userConnections) {
        throw new Error("This method should be overridden.");
    }
}

module.exports = MessageHandler;
