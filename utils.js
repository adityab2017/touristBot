require('dotenv-extended').load();
var translator = require('mstranslator');

//Setup Translator
var client = new translator({
    api_key: process.env.MICROSOFT_TRANSLATOR_KEY // use this for the new token API. 
}, true);

//Standard Responses
var stdResponse = {
    firstInit: "This is your first time using me, which language do you prefer me to reply in?",
    langChanged: "Okay! Your language preference has been changed. ",
    askQn: "To begin, just ask me a question like",
    queryExample: "\n\n- Scan this landmark\n\n- I have questions\n\n- Places to eat",
    techLimitation: "Due to technical limitations, please send me your requests in English.",
    didNotUnderstand: "Sorry, I didn't understand what you said.",
    langReset: "Your language preferences have been reset.",
    resetSuccess: "I've just reset myself, lets try again!",
    startCommand: "Hello! I'm a Tourist Bot.\n\nWhat do you want to do?\n\nEg. ",
    notReady: "Okay! Talk to me when you are ready :)",
    configureLang: "Please configure your language first by saying 'Configure Language'",
    headBack: "Exiting selected functionality",
    imageUpload: "Please upload an image!\n\n Try sending an image or an image URL\n\nEnter 'exit' to return"
};

exports.stdResponse = stdResponse;

exports.hasImageAttachment = function (session) {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
};

exports.checkRequiresToken = function (message) {
    return message.source === 'skype' || message.source === 'msteams';
};

/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
exports.parseAnchorTag = function (input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
};

//=========================================================
// Response Handling
//=========================================================

var queryResponse = {
    successLandmark: "I think it\'s the ",
    failLandmark: "Couldn\'t identify this landmark",
    errorResp:"Oops! Something went wrong. Try again later."
};

exports.handleSuccessResponse = function (session, caption) {
    if (caption) {
        if (session.userData['Lang'] && session.userData['Lang'] !=='en') {
            var paramsTranslateSuccess = {
                text: queryResponse.successLandmark +' '+ caption ,
                from: 'en',
                to: session.userData['Lang']
            };
            client.translate(paramsTranslateSuccess, function (err, dataSuccess) {
                session.send(dataSuccess);
                session.endDialog(caption);
            })
        } else {
            session.send(queryResponse.successLandmark);
            session.endDialog(caption)
        };
    }
    else {
        if (session.userData['Lang'] && session.userData['Lang'] !== 'en') {
            var paramsTranslateFail = {
                text: queryResponse.failLandmark,
                from: 'en',
                to: session.userData['Lang']
            };
            client.translate(paramsTranslateFail, function (err, dataFail) {
                session.endDialog(dataFail);
            })
        } else {
            session.endDialog(queryResponse.failLandmark);
        };
    }
};

exports.handleErrorResponse = function (session, error) {
    var clientErrorMessage = queryResponse.errorResp;
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n\n" + error.message;
    }
    console.error(error);
    if (session.userData['Lang']) {
        var paramsTranslateErr = {
            text: clientErrorMessage,
            from: 'en',
            to: session.userData['Lang']
        };
        client.translate(paramsTranslateErr, function (err, dataErr) {
            session.endDialog(dataErr);
        })
    } else {
        session.endDialog(clientErrorMessage);
    };
};