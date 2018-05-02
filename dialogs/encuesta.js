var builder = require('botbuilder');

module.exports = [
    // Dialog start here
    (session, results) => {
        const callstack = session.sessionState.callstack;
        const dialog_id = callstack[callstack.length - 1].id;
        session.send(`Estàs en: ${dialog_id}`);
        //session.send("Puntuació de l'intent:", results.intent.intent)

        builder.Prompts.choice(session, "Pregunta 1", 
            "A|B", { listStyle: builder.ListStyle.button, retryPrompt: "Torna a provar-ho", promptAfterAction: false });
    },
    (session, results, next) => {
        if (results.response) {
            builder.Prompts.choice(session, "Pregunta 2", 
                "A|B", { listStyle: builder.ListStyle.button, retryPrompt: "Torna a provar-ho", promptAfterAction: false });
        } else {
            next();
        }
    },
    (session, results, next) => {
        if (results.response) {
            builder.Prompts.choice(session, "Pregunta 3", 
                "A|B", { listStyle: builder.ListStyle.button, retryPrompt: "Torna a provar-ho", promptAfterAction: false });
        } else {
            next();
        }
        session.endDialog("Final de l'enquesta");
    }
]