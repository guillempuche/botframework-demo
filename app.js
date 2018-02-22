const builder = require('botbuilder');
const restify = require('restify');
require('dotenv').config()

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    // https://docs.microsoft.com/en-us/bot-framework/bot-service-troubleshoot-authentication-problems
    appId: process.env.MicrosoftAppid,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

bot.dialog('/', [
    (session, results, next) => {
        if (session.conversationData.name == null) {
            session.send("Hola i benvingut! Jo sóc l'APU.");
            builder.Prompts.text(session, "I tu com et dius?");
        } else {
            session.send(`Hola ${session.conversationData.name}!`);
            next();
        }
    },
    (session, results, next) => {
        if (results.response) session.conversationData.name = results.response;
        session.beginDialog('menu');
    },
    (session, next) => {
        session.send("Default dialog");
    }
]).triggerAction({
    matches: [/^hola$/i, /^ei$/i]
});

bot.dialog('menu', [
    (session) => {
        builder.Prompts.choice(session, `Què voldries saber ${session.conversationData.name}?`, 'UPC|ETSETB', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        if (results.response.entity == 'UPC') {
            session.beginDialog('UPC');
        } else session.beginDialog('ETSETB');
    },
    (session, results, next) => {
        session.endDialog("Menu end dialog");
    }
]).triggerAction({
    matches: /^menu$/i
});

bot.dialog('UPC', [
    (session) => {
        builder.Prompts.choice(session, `Quin tema t'agradaria saber? ${session.conversationData.name}?`, 'Sobre carreres|Sobre noticies', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        session.endDialog("UPC end dialog");
    }
]).triggerAction({
    matches: [/^UPC$/i, /^upc$/i]
});