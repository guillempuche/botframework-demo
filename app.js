/**
 * Si se usa debugger de VSCode se deben añadir las variables 'env'
 * en el archivo launch.json para que se carguen.
 */

const builder = require('botbuilder');
const restify = require('restify');
require('dotenv').config();
var MongoClient = require('mongodb').MongoClient;

// URL de la base de datos (desactivada) de la nube de Azure
const url = `mongodb://botframework-demo:${process.env.AZURE_COSMOSDB_MASTER_KEY}@botframework-demo.documents.azure.com:10255/?ssl=true`

// Setup Restify Server
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
 * Más información del objeto devuelto por Recast en https://recast.ai/docs/api-reference/#request-text
 */
bot.recognizer({
    recognize: require('./lib/nlp.js')
})

/**
 * Función para registrar todos los mensajes en:
 *  - CosmosDB -> 'test' database -> 'messages' collection
 */
/*const logUserConversation = (session) => {
    MongoClient.connect(url, function(err, db) {
        if (err) throw err;

        var dbo = db.db("test");

        // insert a new document
        dbo.messages.insertOne(
            {
                "user_id": "1",
                "timestamp": session.timestamp(),
                "bot_name": "bot-demo",
                "channelId": "",
                "locale": "",
                "message_is": "",
                "message": {
                    "context": "",
                    "text": ""
                }
            }
        )
    });
};*/

/**
 * Middleware para registrar mensajes a la base de datos
 * https://github.com/Microsoft/BotBuilder/blob/34454c5ff374c5bb33f21439ded6fed1459e4c0e/Node/core/lib/bots/UniversalBot.js#L104
 */
bot.use({
    // Usuario recibe mensaje del bot
    receive: function (session, next) {
        session.messageForUser = "received";
        require('./lib/log_database').log(session)
        // logUserConversation(session);
        next();
    },
    // Usuario envia mensaje del bot
    send: function (session, next) {
        session.messageForUser = "sent";
        require('./lib/log_database').log(session)
        //logUserConversation(session);

        /*
        // Siguientes lineas sirven para analizar intento y entidades del mensaje
        // Formato del objeto recibido en https://recast.ai/docs/api-reference/#request-text
        //const response = getRecastAnalyse(session);
        //const response = await require('./lib/recast.js').getRecastAnalyse(message, "ca");
        
        const data = response.data.results;
        // Devolver una matriz con solo los valores clave (o nombre principal) de cada entidad
        const entities = Object.keys(response.data.results.entities);
        console.log(`Intent: ${data.intents[0].slug} | Entities: ${entities} | Confidence: ${data.intents[0].confidence}`);
        */
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