/**
 * Analizar texto con NLP de Recast.ai y extraer: intento y entidades
 * Dashboard de Recast: https://recast.ai/guillempuche/botframework-demo
 * 
 * Funciones:
 * - setInformationFromNLPAnalysis(intent)
 * - (función pública) getInformationFromNLPAnalysis()
 * - async getRecastAnalyse(userMessage, locale)
 * - (función pública) async nlp(context, done)
 */

'use strict';

const axios = require('axios');
if (process.env.NODE_ENV !== 'production') { // require('dotenv').config();
    // this put the environment variables = undefined. https://github.com/RecastAI/SDK-NodeJS/issues/35
    require('dotenv').load();
};

// variable global
var intent;

/**
 * Función que guarda el valor del intento recibido de Recast.ai
 * para después poder registrarlo en Chatbase.
 */
function setInformationFromNLPAnalysis(intent) {
    intent = intent;
}

/**
 * Función que devuelve el valor del intento recibido de Recast.ai
 * para después poder registrarlo en Chatbase.
 */
module.exports.getInformationFromNLPAnalysis = () => {
    return intent;
}

/**
 * Función que devuelve el intento del mensaje del usuario via
 * plataforma de NLP Recast.ai.
 */
async function getRecastAnalyse(userMessage, locale) {
    try {
        // Analizar texto https://recast.ai/docs/api-reference/#analyse-endpoints
        return await axios.post('https://api.recast.ai/v2/request',
            {
                text: userMessage,
                // Recast solo acepta estos codigos de idiomas: https://www.iso.org/iso-639-language-codes.html
                language: locale,
            },
            {
                headers: { Authorization: `Token ${process.env.RECAST_REQUEST_TOKEN}` }
            })
    } catch(err) {
        console.error(`Error en: getRecastAnalyse() | "${err}"`);
    };
};

/**
 * Función usada para el bot.recognizer() donde se descifra el intento.
 */
module.exports.nlp = async function (context, done) {
    // Resultados devueltos por el 'recognizer' de intentos
    // https://docs.botframework.com/en-us/node/builder/chat-reference/interfaces/_botbuilder_d_.iintentrecognizerresult.html
    var intent = {
        score: 0.0,
        intent: null, // string
        entities: [] // array
    };

    if (context.message.text) {
        try {
            const response = await getRecastAnalyse(context.message.text, "ca");
            const data = response.data.results;
            
            // Comprovar que existe un intento detectado. Para comprobar que el intento
            // tiene una confidencia mínima de 0.4 se establece en el archivo 'app.js'
            if (data.intents.length != 0) {
                // Devolver una matriz con solo los valores clave (o nombre principal) de cada entidad
                const entities = Object.keys(data.entities);
                
                // Devolver objeto 'intent' para el 'bot.recognizer'
                intent = {
                    score: data.intents[0].confidence,
                    intent: data.intents[0].slug,
                    entities: entities
                };

                console.log(`Analisis NLP - Intent: '${intent.intent}' | Entities: '${intent.entities}' | Confidence: ${intent.score}`);
            } else {
                // Avisar a Bot Builder que bloquee el intento
                // callback(null, { score: 0.0, intent: null }) to block an intent from being returned
                // https://docs.botframework.com/en-us/node/builder/chat-reference/classes/_botbuilder_d_.recognizerfilter.html#onrecognized
                intent = {
                    score: 0.0,
                    intent: null,
                };

                console.log(`Analisis NLP - Intent: '${intent.intent}'`);
            }

            setInformationFromNLPAnalysis(intent.intent);
        } catch (err) {
            console.error(`Error en: bot.recognizer() | "${err}"`);
        }
    }
    done(null, intent);
}