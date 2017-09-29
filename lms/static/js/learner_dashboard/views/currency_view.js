(function(define) {
    'use strict';
    define(['backbone',
        'jquery',
        'underscore',
        'gettext',
        'edx-ui-toolkit/js/utils/html-utils',
        'which-country'
    ],
         function(
             Backbone,
             $,
             _,
             gettext,
             HtmlUtils,
             wc
         ) {
             return Backbone.View.extend({
                 el: 'input[name="verified_mode"]',

                 initialize: function(options) {
                     this.options = options;
                     this.getUserLocation();
                 },

                 getUserLocation: function() { 
                     navigator.geolocation.getCurrentPosition(this.getCountry.bind(this)); 
                 }, 

                 getCountry: function(position) {
                    var countryCode = wc([position.coords.longitude, position.coords.latitude]);
                    console.log(countryCode);
                 }
             });
         }
    );
}).call(this, define || RequireJS.define);
