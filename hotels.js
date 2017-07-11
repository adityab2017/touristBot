var builder = require('botbuilder');
var Store = require('./store');

module.exports = [
     //Destination
    function (session) {
        if (!session.dialogData.destination) {
            builder.Prompts.text(session, 'Please enter your destination');
        }
     },
    function (session, results, next) {
        session.dialogData.destination = results.response;
        session.send('Looking for places to eat around %s', session.dialogData.destination);
        next();
    },

    // cuisine
    function (session) {
        builder.Prompts.text(session, 'Which cuisine would you like?');
    },
    function (session, results, next) {
        session.dialogData.cuisine = results.response;
        next();
    },

    // Search...
    function (session) {
        var destination = session.dialogData.destination;
        var cuisine = session.dialogData.cuisine;

        session.send(
            'Ok. Searching for places to eat in %s with %s cuisine...',
            destination,
            cuisine);

        // Async search
        Store
            .searchCuisine(destination, cuisine)
            .then(function (cuisine) {
                // Results
                session.send('I found in total %d restaurants for your cuisine:', cuisine.length);

                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cuisine.map(cuisineAsAttachment));

                session.send(message);

                // End
                session.endDialog();
            });
    }
];

// Helpers
function cuisineAsAttachment(cuisine) {
    return new builder.HeroCard()
        .title(cuisine.name)
        .subtitle('%d stars. %d reviews. From $%d per meal.', cuisine.rating, cuisine.numberOfReviews, cuisine.priceStarting)
        .images([new builder.CardImage().url(cuisine.image)])
        .buttons([
            new builder.CardAction()
                .title('More details')
                .type('openUrl')
                .value('https://www.zomato.com/singapore/summer-pavilion-downtown-core')
        ]);
}
