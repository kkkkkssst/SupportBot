class MessageHandler {
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
