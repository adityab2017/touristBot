var Promise = require('bluebird');

module.exports = {
    searchCuisine: function (destination, cuisine) {
        return new Promise(function (resolve) {

            // Filling the Restaurant results manually just for demo purposes
            var cuisine = [];
            for (var i = 1; i <= 5; i++) {
                cuisine.push({
                    name: ' Restaurant ' + i,
                    location: destination,
                    rating: Math.ceil(Math.random() * 5),
                    numberOfReviews: Math.floor(Math.random() * 500) + 1,
                    priceStarting: Math.floor(Math.random() * 45) + 80,
                    image: 'https://placeholdit.imgix.net/~text?txtsize=35&txt=Restaurant+' + i + '&w=500&h=260'
                });
            }

            cuisine.sort(function (a, b) { return a.priceStarting - b.priceStarting; });

            // complete promise with a timer to simulate async response
            setTimeout(function () { resolve(cuisine); }, 1000);
        });
    }
};