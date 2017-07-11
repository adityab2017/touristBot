// JavaScript source code
//https://d271dy38uexjzn.cloudfront.net/wp-content/uploads/image04-9.jpg
// References
require('dotenv-extended').load();
var needle              = require('needle'),
    url                 = require('url'),
    validUrl            = require('valid-url'),
    captionService      = require('./caption-service'),
    restify             = require('restify'),
    builder             = require('botbuilder'),
    request             = require('request'),
    utils               = require('./utils'),
    translator          = require('mstranslator'); 

//Setup Translator
var client = new translator({
    api_key: process.env.MICROSOFT_TRANSLATOR_KEY // use this for the new token API. 
}, true);

//Standard Replies
var standardReplies = utils.stdResponse;

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

//LUIS Setup
var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/' + process.env.LUIS_APP_KEY + '?subscription-key=' + process.env.LUIS_SUBS_KEY +'&verbose=true&timezoneOffset=0&q=');
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

// Bot Dialog Functions
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
                var paramsTranslateEg = {
                    text: standardReplies.queryExample,
                    from: 'en',
                    to: lang
                };

                client.translate(paramsTranslateTo, function (err, dataStart) {
                    client.translate(paramsTranslateEg, function (err, dataEg) {
                        session.send(dataStart);
                        session.send(dataEg);
                        session.endDialog('i.e.\n\n (' + standardReplies.queryExample + '\n\n)');
                    });
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

//Image Landmark Caption
bot.dialog('/landmark', function (session, args) {
    
    if (utils.hasImageAttachment(session)) {
        var stream = getImageStreamFromMessage(session.message);
        captionService
            .getCaptionFromStream(stream)
            .then(function (caption) { utils.handleSuccessResponse(session, caption); })
            .catch(function (error) { utils.handleErrorResponse(session, error); });
    }
    else if (utils.parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null)) {
        var imageUrl = utils.parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
        if (imageUrl) {
            captionService
                .getCaptionFromUrl(imageUrl)
                .then(function (caption) { utils.handleSuccessResponse(session, caption); })
                .catch(function (error) { utils.handleErrorResponse(session, error); });
        }
    }
    else if (session.message.text == 'exit') {
        if (session.userData['Lang']) {
            var paramsTranslate = {
                text: standardReplies.headBack,
                from: 'en',
                to: session.userData['Lang']
        };
        client.translate(paramsTranslate, function (err, dataTranslate) {
            session.endDialog(dataTranslate);
        })
        } else {
            session.endDialog(standardReplies.headBack);
        };
    }

    else {
         if (session.userData['Lang']) {
            var paramsTranslate = {
                text: standardReplies.imageUpload,
                from: 'en',
                to: session.userData['Lang']
            };
            client.translate(paramsTranslate, function (err, dataDefault) {
                session.send(dataDefault);
            })
         } else {
            session.send(standardReplies.imageUpload);
         };
    }
});

//Get image from input

function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (utils.checkRequiresToken(message)) {
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