(function(define) {
    'use strict';

    define([
        'js/learner_dashboard/views/currency_view'
    ],
    function(CurrencyView) {
        return function(options) {
            var Currency = new CurrencyView(options);
            return Currency;
        };
    });
}).call(this, define || RequireJS.define);
