// JavaScript source code

// References
require('dotenv-extended').load();
var needle = require('needle'),
    url = require('url'),
    validUrl = require('valid-url'),
    captionService = require('./caption-service'),
    restify = require('restify'),
    builder = require('botbuilder'),
    request = require('request'),
    translator = require('mstranslator'); 


//Keys
var key = {
    msTranslator: "242f8c1667d94c0f889dd0638078002f", //ToDo - Move to env
    luisAppKey: '3479dc0e-a737-457d-8be1-acb8c73b9b79',
    luisSubsKey: 'de3edb6083aa47b5aa2b1957f956284a'
};

//Setup Translator
var client = new translator({
    api_key: key.msTranslator // use this for the new token API. 
}, true);

//Standard Replies
var standardReplies = {
    firstInit: "This is your first time using me, which language do you prefer me to reply in?",
    langChanged: "Okay! Your language preference has been changed. ",
    askQn: "To begin, just ask me a question like",
    queryExample: "\n- Which landmark is this?\n- Tell me places to visit",
    techLimitation: "Due to technical limitations, please send me your requests in English.",
    didNotUnderstand: "Sorry, I didn't understand what you said.",
    langReset: "Your language preferences have been reset.",
    resetSuccess: "I've just reset myself, lets try again!",
    startCommand: "Hello! I'm a Tourist Bot.\n\nWhat do you want to do?\n\nEg. ",
    notReady: "Okay! Talk to me when you are ready :)",
    configureLang: "Please configure your language first by saying 'Configure Language'"
    };

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

//LUIS Setup
var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/' + key.luisAppKey + '?subscription-key=' + key.luisSubsKey +'&verbose=true&timezoneOffset=0&q=');
var intentDialog = new builder.IntentDialog({ recognizers: [recognizer] });

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector, { persistConversationData: true });
server.post('/api/messages', connector.listen());

// Bot Dialogs
bot.dialog('/', intentDialog);

//LUIS Intents
intentDialog.matches(/\b(hello|hi|hey|how are you)\b/i, '/conversation')
    .matches(/\b(rlang)\b/i, '/resetLang')
    .matches(/\b(rbot)\b/i, '/resetLang')
    .matches('getPlacethruPic', '/landmark')
    .onDefault('/defaultResp');

bot.dialog('/defaultResp', function (session, args) {
    if (session.userData['Lang']) {
        var paramsTranslateToDefault = {
            text: standardReplies.didNotUnderstand,
            from: 'en',
            to: session.userData['Lang']
        };
        client.translate(paramsTranslateToDefault, function (err, dataDefault) {
            session.endDialog(dataDefault);
        })
    } else {
        session.endDialog(standardReplies.didNotUnderstand);
    };

});

bot.dialog('/resetLang', function (session, args) {
    session.sendTyping();
    session.userData['Lang'] = null;
    session.endDialog(standardReplies.langReset);
});

bot.dialog('/resetBot', function (session, args) {
    session.sendTyping();
    session.userData['Lang'] = null;
    session.endDialog(standardReplies.resetSuccess);
    session.endConversation();
});

bot.dialog('/conversation', [function (session, args) {
    session.sendTyping();
    var lang = session.userData['Lang'];
    if (!lang) {
            session.send("Hello! Welcome to the Tourist Bot.");
            console.log("User's first load or language reset.");

            builder.Prompts.choice(session, standardReplies.firstInit, "English|Chinese|Japanese|Tamil|Hindi|Cancel");
    } else {
            console.log("User Lang Data Exists: " + lang);

            if (lang == "en") {
                session.endDialog(standardReplies.startCommand + standardReplies.queryExample);
            } else {
                var paramsTranslateTo = {
                    text: standardReplies.startCommand,
                    from: 'en',
                    to: lang
                };

                client.translate(paramsTranslateTo, function (err, data) {
                    session.endDialog(data + standardReplies.queryExample);
                });
            }
    }
    }, function (session, results) {
        session.sendTyping();
        if (results.response && results.response.entity !== 'Cancel') {
            var fullLang = "English";

            //Add more languages for your liking, add prompt on top also
            if (results.response.entity.toUpperCase() == "ENGLISH") {
                session.userData['Lang'] = 'en';
                fullLang = "English";
            } else if (results.response.entity.toUpperCase() == "CHINESE") {
                session.userData['Lang'] = 'zh-chs';
                fullLang = "中文";
            } else if (results.response.entity.toUpperCase() == "JAPANESE") {
                session.userData['Lang'] = 'ja';
                fullLang = "日本語";
            } else if (results.response.entity.toUpperCase() == "TAMIL") {
                session.userData['Lang'] = 'ta';
                fullLang = "தமிழ்";
            } else if (results.response.entity.toUpperCase() == "HINDI") {
                session.userData['Lang'] = 'hi';
                fullLang = "हिन्दी";
            }

            var paramsTranslateTo = {
                text: standardReplies.langChanged,
                from: 'en',
                to: session.userData['Lang']
            };

            var paramsTranslateTo2 = {
                text: standardReplies.techLimitation,
                from: 'en',
                to: session.userData['Lang']
            };

            var paramsTranslateTo3 = {
                text: standardReplies.askQn,
                from: 'en',
                to: session.userData['Lang']
            };

           

            client.translate(paramsTranslateTo, function (err, data) {
                client.translate(paramsTranslateTo2, function (err, data2) {
                    client.translate(paramsTranslateTo3, function (err, data3) {
                        session.send(data + "(" + fullLang + ")");
                        session.send(data2);
                        session.endDialog(data3 + standardReplies.queryExample);
                    });
                });
            });
        } else {
            session.endDialog(standardReplies.notReady);
        }
    }
    ]);


//Image Caption

bot.dialog('/landmark', function (session, args) {
    if (hasImageAttachment(session)) {
        var stream = getImageStreamFromMessage(session.message);
        captionService
            .getCaptionFromStream(stream)
            .then(function (caption) { handleSuccessResponse(session, caption); })
            .catch(function (error) { handleErrorResponse(session, error); });
    }
    else if (session.message.text=='exit'){
        session.endDialog('Heading Back');
    }
    else {
        var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
        if (imageUrl) {
            captionService
                .getCaptionFromUrl(imageUrl)
                .then(function (caption) { handleSuccessResponse(session, caption); })
                .catch(function (error) { handleErrorResponse(session, error); });
        } else {
            session.send('Please upload an image! Try sending an image or an image URL');
        }
    }
});

//=========================================================
// Utilities
//=========================================================
function hasImageAttachment(session) {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}

function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        // The Skype attachment URLs are secured by JwtToken,
        // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
        // https://github.com/Microsoft/BotBuilder/issues/662
        connector.getAccessToken(function (error, token) {
            var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}

function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}

/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

//=========================================================
// Response Handling
//=========================================================
function handleSuccessResponse(session, caption) {
    if (caption) {
        session.send('I think it\'s ' + caption);
    }
    else {
        session.send('Couldn\'t find a caption for this one');
    }

}

function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }

    console.error(error);
    session.send(clientErrorMessage);
}