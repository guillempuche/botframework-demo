/**
 * Funciones:
 * - (funcion publica) async setAnalyticOnDashbot(messageWatchedFromBot, message)
 * - ERROR! (funcion publica) async setAnalyticOnChatbase(messageWatchedFromBot, messageForChatBase)
 */

'use strict';

const axios = require('axios');
if (process.env.NODE_ENV !== 'production') { // require('dotenv').config();
    // this put the environment variables = undefined. https://github.com/RecastAI/SDK-NodeJS/issues/35
    require('dotenv').load();
};

/**
 * Función para enviar cada mensaje recibido y enviado del bot a Dashbot
 * Argumento 'message' = { user, userId, message, intent }
 * 
 * Más información en https://www.dashbot.io/docs/generic/rest/
 */
module.exports.setAnalyticOnDashbot = async function (messageWatchedFromBot, message) {
    try {
        const messageFormatted = {
            "text": message.text,
            "userId": message.userId
        };
        
        // Convertir mensaje a formato JSON para que Dashbot lo entienda
        var jsonMessage = JSON.stringify(messageFormatted);

        // Filtrar el nuevo mensaje segun ha sido enviado por el bot o lo ha
        // recibido del usuario
        if (messageWatchedFromBot == "sent") { // Bot ha enviado el mensaje hacia el usuario

            return await axios.post(`https://tracker.dashbot.io/track?platform=generic&v=9.8.0-rest&type=outgoing&apiKey=${process.env.DASHBOT_KEY}`,
                jsonMessage,
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
        } else if (messageWatchedFromBot == "received") { // Bot ha recibido el mensaje del usuario
            jsonMessage = JSON.stringify({
                "text": message.text,
                "userId": message.userId,
                "intent": {
                        "name": require('./nlp').getInformationFromNLPAnalysis()
                    }
            })
            return await axios.post(`https://tracker.dashbot.io/track?platform=generic&v=9.8.0-rest&type=incoming&apiKey=${process.env.DASHBOT_KEY}`,
                jsonMessage,
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
        }
    } catch(err) {
        console.error(`Error en: setAnalyticOnDashbot() | "${err}"`);
    };
}

/**
 * ERROR: esta función no registra los mensjes en Chatbase!
 * 
 * Función para enviar cada mensaje recibido y enviado del bot a Chatbase
 * Argumento 'messageForChatbase' = { user, userId, message, intent }
 * 
 * https://chatbase.com/documentation/generic
 */
module.exports.setAnalyticOnChatbase = async function (messageWatchedFromBot, messageForChatbase) {
    try {
        // Filtrar el nuevo mensaje segun ha sido enviado por el bot o lo ha
        // recibido del usuario
        if (messageWatchedFromBot == "sent") { // Bot ha enviado el mensaje hacia el usuario
            return await axios.post('https://chatbase.com/api/message',
            {
                "api_key": process.env.CHATBASE_KEY,
                "type": messageForChatbase.user, // "agent"
                "user_id": messageForChatbase.userId,
                // IMPORTANTE: 'time_stamp' solo tiene que declarase si tiene
                // un Unix Epoch con precisión de MS (milisegundos)
                "time_stamp": Date.now(),
                "platform": "BotFramework",
                "message": messageForChatbase.message,
                "version": "0.2.0", // Versión en el package.json
                // "session_id: "123456789"
            })
        } else if (messageWatchedFromBot == "received") { // Bot ha recibido el mensaje del usuario    
            return await axios.post('https://chatbase.com/api/message',
                {
                    "api_key": process.env.CHATBASE_KEY,
                    "type": messageForChatbase.user, // "user"
                    "user_id": messageForChatbase.userId,
                    // IMPORTANTE: 'time_stamp' solo tiene que declarase si tiene
                    // un Unix Epoch con precision de MS (milisegundos)
                    "time_stamp": Date.now(),
                    "platform": "BotFramework",
                    "message": messageForChatbase.message,
                    // "not_handled": ,
                    // "intent": ,
                    // "version": "1.1",
                    // "session_id: "123456789"
                })
        }
    } catch(err) {
        console.error(`Error en: setAnalyticOnChatbase() | "${err}"`);
    };
}