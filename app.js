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
const url = require('url');
var MongoClient = require('mongodb').MongoClient;
var savedAddress; // variable para guardar dirección para el broadcasting

// URL de la base de datos (desactivada) de la nube de Azure
const urlDatabase = `mongodb://botframework-demo:${process.env.AZURE_COSMOSDB_MASTER_KEY}@botframework-demo.documents.azure.com:10255/?ssl=true`

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
});

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

            require('./lib/log_database').logMessage(session)
        }
        next();
    }
});

/**
 * Crear un 'endpoint' GET para empezar el dialogo proactivo.
 * 
 * Ejemplo en https://github.com/Microsoft/BotBuilder-Samples/tree/master/Node/core-proactiveMessages
 */
server.get('/api/broadcastSample', function (req, res, next) {
    // El método url.parse() toma una cadena URL, la analiza ydevuelve un objeto URL.
    // 'url.parse(urlString[, parseQueryString[, slashesDenoteHost]])'
    // urlString <string> - Es la cadena URL para analizar o 'parse'.
    var query = url.parse(req.url, true).query;
    // beginDialogAction(name: string, id: string, options?: IBeginDialogActionOptions)
        // name: string - Unique name to assign the action.
        // id: string - ID of the dialog to start.
        // options - (Optional) options used to configure the action or pass additional params
    // Más información en https://docs.botframework.com/en-us/node/builder/chat-reference/classes/_botbuilder_d_.intentdialog.html#begindialogaction
    bot.beginDialog(savedAddress, "*:/broadcastDialog", {
        dialogArgs: {
            broadcastMessage: query.message
        }
    });
    //require('./lib/broadcast').startProactiveDialog(savedAddress, query.message);
    res.send('triggered');
    next();
});


bot.dialog('/', [
    (session, results, next) => {
        session.send("Inici");
    }
]).reloadAction("Inicio", {
    matches: [/^inicio$/i]
});

/**
 * Diálogo que envia al usuario el mensaje que ha recibido
 * via endpoint '/api/broadcastSample'.
 */
bot.dialog('/broadcastDialog', [
    (session, args) => {
        session.send(`[BROADCAST] ${args.dialogArgs.broadcastMessage}`)
        session.endDialog("[BROADCAST] Fi del 'broadcastDialog'");
    }
]);

/**
 * Cuando se activa 'customAction', la opción 'onSelectAction'
 * puede procesar la solicitud sin presionar nuevos cuadros de diálogo
 * en la pila. Una vez que se completa la acción, el control vuelve al
 * diálogo que está en la parte superior de la pila y el bot puede continuar.
 */
bot.customAction({
    matches: /^rss$/i,
    onSelectAction: (session, args, next) => {
        savedAddress = session.message.address;
        const message = 'http://localhost:' + server.address().port + "/api/broadcastSample";

        session.send("Informació útil pel Broadcast");
        session.send(`URL: ${message}`);
    }
});

bot.dialog('/nombre', [
    (session, results, next) => {
        savedAddress = session.message.address;
        
        if (session.conversationData.name == undefined) {
            session.send("Hola i benvingut! Jo sóc l'APU.");
            builder.Prompts.text(session, "I tu com et dius?");
        } else {
            session.send(`Hola ${session.conversationData.name}!`);
            next();
        }
    },
    (session, results) => {
        if (results && results.response) session.conversationData.name = results.response;
        session.beginDialog('menu');
    },
    (session) => {
        session.send("Default dialog");
    }
]).triggerAction({
    matches: [/^hola$/i, /^ei$/i]
}).cancelAction('cancelNombre', "Ok, pararé el dialeg.", {
    matches: /^cancelar$|^cancel$|^cancel.*order/i
});

bot.dialog('menu', [
    (session) => {
        builder.Prompts.choice(session, `Què voldries saber ${session.conversationData.name}?`, 'UPC|ETSETB', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        if (results && results.response.entity == 'UPC') {
            session.beginDialog('UPC');
        } else session.beginDialog('ETSETB');
    },
    (session, results, next) => {
        session.endDialog("Menu end dialog");
    }
]).triggerAction({
    matches: /^menu$/i
}).cancelAction('cancelUPC', "Ok, pararé el dialeg UPC.", {
    matches: /^cancelar$|^cancel$|^cancel.*order/i
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
