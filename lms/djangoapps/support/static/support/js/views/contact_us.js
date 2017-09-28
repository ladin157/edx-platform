(function(define) {
    'use strict';

    define([
        'backbone',
        'underscore',
        'support/js/models/file',
        'text!support/templates/upload_file.underscore'

    ], function(Backbone, _, FileModel, FileTemplate) {
        return Backbone.View.extend({

            events: {
                'change #attachment': 'selectFile'
            },

            selectFile : function (e) {
                var fileModel = new FileModel({
                    'fileName': e.target.files[0].name
                });
                var $fileContainer = this.$el.find('.files-container');
                $fileContainer.html(_.template(FileTemplate)(fileModel.toJSON()));

            }
        });
    });
}).call(this, define || RequireJS.define);
