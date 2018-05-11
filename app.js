/**
 * Si se usa debugger de VSCode se deben añadir las variables 'env'
 * en el archivo launch.json para que se carguen.
 */

'use strict';

if (process.env.NODE_ENV !== 'production') { // require('dotenv').config();
    // this put the environment variables = undefined. https://github.com/RecastAI/SDK-NodeJS/issues/35
    require('dotenv').load();
};
const builder = require('botbuilder');
const restify = require('restify');
var MongoClient = require('mongodb').MongoClient;

// URL de la base de datos (desactivada) de la nube de Azure
const url = `mongodb://botframework-demo:${process.env.AZURE_COSMOSDB_MASTER_KEY}@botframework-demo.documents.azure.com:10255/?ssl=true`

// Configurar servidor Restify
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    // https://docs.microsoft.com/en-us/bot-framework/bot-service-troubleshoot-authentication-problems
    
    // Test on Web Chat Emulator Localhost
    appId: null,
    appPassword: null

    // Deploy on Azure App Service
    //appId: process.env.MicrosoftAppId,
    //appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Referencias par UniversalBot
//  https://docs.botframework.com/en-us/node/builder/chat-reference/classes/_botbuilder_d_.universalbot.html
var bot = new builder.UniversalBot(connector);

/**
 * Comprobar que el intento tiene una confidencia mínima de
 * 0.4 para que no haya limitar los errores de analisis NLP.
 * Modificar el limite por defecto de 0.1 a 0.4
 * https://docs.botframework.com/en-us/node/builder/chat-reference/interfaces/_botbuilder_d_.iintentdialogoptions.html
 */ 
const commonIntentDialog = new builder.IntentDialog({
    intentThreshold: 0.4
})

/**
 * Función 'recognizer' para decir a Bot Framework cuál es el intento del mensaje del usuario
 * Utiliza la plataforma de NLP de Recast.ai que analiza intento y entidades del mensaje.
 * 
 * IMPORTANTE: esta función se ejecuta después de bot.use()
 * 
 * Más información del objeto devuelto por Recast en https://recast.ai/docs/api-reference/#request-text
 */
bot.recognizer({
    recognize: require('./lib/nlp').nlp
})

/**
 * Función middleware para registrar mensajes a la base de datos.
 * 
 * IMPORTANTE: esta función se ejecuta antes de bot.recognizer(),
 * es decir, se ejectura antes de saber el 'intent' del mensaje.
 * 
 * Más información en https://github.com/Microsoft/BotBuilder/blob/34454c5ff374c5bb33f21439ded6fed1459e4c0e/Node/core/lib/bots/UniversalBot.js#L104
 */
bot.use({
    // El bot recibe un mensaje
    botbuilder: function (session, next) { // IMPORTANTE: objeto 'session' es diferente que en mensaje enviado
        // Filtrar el mensaje del objeto 'session' ya que entre los mensajes
        // del usuario o el bot hay informacion irrelevante 'conversationUpdate'
        if (session.type != "conversationUpdate") {
            session.messageWatchedFromBot = "received";
            require('./lib/log_database').logMessage(session)
        }
        next();
    },
    // El bot envia un mensaje
    // ALERTA: cuando se debuga se puede ver que cuando el bot envia 2
    // mensajes y sin se retrasa la ejecución se envia 2 objetos
    // 'session' que cuando se procesan 'require().logMessage'
    // se executan las operaciones practicamente al mismo tiempo. Es decir, no
    // se ejecuta todo el codigo de de 'logMessage' sino que se ejecuta algunas linias
    // se ejecutan primero para cada objeto 'session' y despues se ejecuta otra linia.
    send: function (session, next) { // IMPORTANTE: objeto 'session' es diferente que en mensaje recibido 
        // Filtrar el mensaje del objeto 'session' ya que entre los mensajes
        // del usuario o el bot hay informacion irrelevante 'conversationUpdate'
        if (session.type != "conversationUpdate") {
            session.messageWatchedFromBot = "sent";

            // Se tiene que retrasar (mínimo 40 milisegundos ) porque cuando
            // el bot envia 2 mensajes la plataforma Dashbot los registra
            // en orden inverso. Se puede comprobar quitando el retraso.
            setTimeout(require('./lib/log_database').logMessage(session), 40);
        }
        next();

    }
});

/**
 * Función 'Dialog' que interectua con el usuario.
 * Tiene el objetivo de testear nuevas funciones para el chat.
 */
bot.dialog('/', [
    (session, results, next) => {
        if (session.conversationData.name == undefined) {
            session.send("Hola i benvingut! Jo sóc l'APU.");
            builder.Prompts.text(session, "I tu com et dius?");
        } else {
            session.send(`Hola ${session.conversationData.name}!`);
            next();
        }
    },
    (session, results) => {
        if (results.response) session.conversationData.name = results.response;
        session.beginDialog('menu');
    },
    (session) => {
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