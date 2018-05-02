/*
    1. Registrar todos los mensajes a una base de datos MongoDB.
        Para iniciar Azure Cosmos DB Emulator: $ CosmosDB.Emulator.exe
    2. Analytics:
        A. CHATBASE integration https://github.com/google/chatbase-node
        B. DASHBOT integration https://github.com/actionably/dashbot
*/

require('dotenv').config();
var MongoClient = require('mongodb').MongoClient;
const chatbase = require('@google/chatbase')
    .setApiKey('89d12aaf-1a74-415d-946d-f0e8e0951fac')
    .setPlatform('BotFramework Test')
    .setUserId('demo') // a unique string identifying the user which the bot is interacting with
    .setVersion('1.0');
var dashbot = require('dashbot')({apiKey: process.env.DASHBOT_KEY, debug: true}).generic;

// Configuración de la base de datos local en CosmosDB
// IMPORTANTE: 'emulator_key' se tiene que definir antes, sino encodeURIComponent() devuelve 'undefined'
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
 * Log all message on:
 *  CosmosDB -> 'test' databass -> 'messages' collection
 * 
 * 3 collections on 'test' database:
 *  - chat: messages recorded
 *  - user: user information
 *  - chatState: to store userData, conversationData and dialogData
 */
var log = (session) => {
    MongoClient.connect(url, function(err, database) {
        if (err) throw console.log(err);

        var db = database.db("test");
        
        // error handling https://docs.mongodb.com/manual/reference/method/db.collection.insertOne/#error-handling
        try {
            if (session.messageForUser == "sent" && session.type != "conversationUpdate") {
                console.log("Bot ha recibido un mensaje");

                // Dashbot integration
                // https://www.dashbot.io/docs/generic/node
                const messageForDashbot = {
                    "text": session.text,
                    "userId": "demo"
                };
                
                //dashbot.logOutgoing(messageForDashbot);

                /*
                chatbase.newMessage()
                .setAsTypeAgent() // sets the message as type agent
                .setMessage(session.text) // the message sent by either user or agent
                // WARNING: setTimestamp() should only be called with a Unix Epoch with MS precision
                .setTimestamp(Date.now().toString()) // Only unix epochs with Millisecond precision
                .send()
                .catch(e => console.error(e));
                //.setAsTypeUser() // The type of message you are sending to chatbase: user (user) or agent (bot)
                //.setAsTypeAgent() // sets the message as type agent
                //.setAsHandled() // set the message as handled -- this means the bot understood the message sent by the user
                */
               // insert a new document
               db.collection('chat').insertOne(
                   {
                       message_is: session.messageForUser,
                       // user: [session.address.user],
                       // address_id: session.address.id,
                       // conversation_id: session.address.conversation.id,
                       message: [session],
                       // dialog_id: ""
                    }
                );
            } else if (session.type != "conversationUpdate") {
                console.log("Bot ha enviado un mensaje");
                
                /*
                // Dashbot integration
                // https://www.dashbot.io/docs/generic/node
                const messageForDashbot = {
                    "text": session.text,
                    "userId": "demo"            
                };
                //dashbot.logIncoming(messageForDashbot);
                */
               
                db.collection('chat').insertOne(
                    {
                        message_is: session.messageForUser,
                        // user: [session.recipient],
                        // address_id:
                        // conversation_id: \
                        message: [session],
                        // dialog_id: ""
                    }
                );
            }
        } catch (e) {
            console.log(e);
        }
    });
};

module.exports.log = log;