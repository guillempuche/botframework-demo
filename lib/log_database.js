/*
 * Funciones:
 *  - (funcion publica) logMessage(session)
 *  
 * 1. Registrar todos los mensajes a una base de datos MongoDB.
 *     Para iniciar Azure Cosmos DB Emulator: $ CosmosDB.Emulator.exe
 * 2. Analiticas de todos los mensajes:
 *     A. CHATBASE integration https://github.com/google/chatbase-node
 *     B. DASHBOT integration https://github.com/actionably/dashbot
 */

'use strict';

if (process.env.NODE_ENV !== 'production') { // require('dotenv').config();
    // this put the environment variables = undefined. https://github.com/RecastAI/SDK-NodeJS/issues/35
    require('dotenv').load();
};
var MongoClient = require('mongodb').MongoClient;
var dashbot = require('dashbot')({apiKey: process.env.DASHBOT_KEY, debug: true}).generic;

// Configuración de la base de datos local en CosmosDB Emulator
// IMPORTANTE: para configurar CosmosDB Emulator, 'emulator_key' se tiene
// que definir antes, sino encodeURIComponent() devuelve un 'undefined'
const emulator_key = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="; 
const url = `mongodb://localhost:${encodeURIComponent(emulator_key)}@localhost:10250/admin?ssl=true`
// URL de la base de datos (desactivada) de la nube de Azure
    // const url = `mongodb://botframework-demo:${process.env.AZURE_COSMOSDB_MASTER_KEY}@botframework-demo.documents.azure.com:10255/?ssl=true`
// Ejemplos de URLs
    // var url = "mongodb://localhost:27017/EmployeeDB";
    // var url = 'mongodb://<endpoint>:<password>@<endpoint>.documents.azure.com:10255/?ssl=true';
    // mongodb://username:password@host:port/[database=optional]?ssl=true

/**
 * Conectarse y registrar mensajes a la base de datos (o 'db').
 * Encode the emulator key only with encodeURIComponent() is who only encode '/', not encodeURI() or escape()
 *  http://www.javascripter.net/faq/escape.htm
 *  
 * Registrar todos los mensajes en:
 *  CosmosDB -> 'test' databass -> 'messages' collection
 * 
 * 3 colecciones en la base de datos 'test':
 *  - chat: messages recorded
 *  - user: user information
 *  - chatState: to store userData, conversationData and dialogData
 */
module.exports.logMessage = (session) => {
    // Funcion 'async' porque tiene un 'await' directamente incluido en ella
    MongoClient.connect(url, async function(err, database) {
        if (err) throw console.log(`Error en: MongoClient.connect() | ${err}`);

        var db = database.db("test");
        
        try {
            var messageForChatbase, messageForDashbot;

            if (session.messageWatchedFromBot == "sent") {
                //console.log("Bot ha enviado un mensaje");
                
                // Objeto para que en otra parte del código se envie a Dashbot
                messageForDashbot = {
                    "text": session.text, // objeto 'session' tiene texto en 'session.text'
                    "userId": "test"
                };
                
                // Insertar nuevo 'document' en la colección 'chat'
                // IMPORTANTE: Manejo de errores en MongoDB https://docs.mongodb.com/manual/reference/method/db.collection.insertOne/#error-handling
                db.collection('chat').insertOne(
                    {
                        message_is: session.messageWatchedFromBot,
                        // user: [session.address.user],
                        // address_id: session.address.id,
                        // conversation_id: session.address.conversation.id,
                        message: [session],
                        // dialog_id: ""
                    }
                );
            } else if (session.messageWatchedFromBot == "received") {
                //console.log("Bot ha recibido un mensaje");

                messageForDashbot = {
                    "text": session.message.text,
                    "userId": "test"            
                };
               
                db.collection('chat').insertOne(
                    {
                        message_is: session.messageWatchedFromBot,
                        // user: [session.recipient],
                        // address_id:
                        // conversation_id: \
                        message: [session.message],
                        // dialog_id: ""
                    }
                );
            }
            
            // Registrar mensaje recibido y enviado a la plataforma analítica Dashbot.
            // Se tiene que retrasar (mínimo 40 milisegundos ) porque cuando
            // el bot envia 2 mensajes la plataforma Dashbot los registra
            // en orden inverso. Se puede comprobar quitando el retraso.
             setTimeout(async () => {
                    await require('./analytics').setAnalyticOnDashbot(session.messageWatchedFromBot, messageForDashbot)
                }, 40);
        } catch (err) {
            console.log(`Error en: logMessage() | "${err}"`);
        }
    });
};