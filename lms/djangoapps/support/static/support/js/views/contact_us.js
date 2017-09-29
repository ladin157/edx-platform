(function (define) {
    'use strict';

    define([
        'backbone',
        'underscore',
        'support/js/models/file',
        'text!support/templates/upload_file.underscore'

    ], function (Backbone, _, FileModel, FileTemplate) {
        return Backbone.View.extend({
            accessToken: 'd6ed06821334b6584dd9607d04007c281007324ed07e087879c9c44835c684da',
            uploadFileUrl: 'https://arbisoft.zendesk.com/api/v2/uploads.json',

            events: {
                'change #attachment': 'selectFile'
            },

            selectFile: function (e) {
                var fileName = e.target.files[0].name,
                    request = new XMLHttpRequest(),
                    $fileContainer = this.$el.find('.files-container'),
                    fileModel,
                    data;

                request.open('POST', this.uploadFileUrl, true);
                request.setRequestHeader("Authorization", "Bearer " + this.accessToken);
                request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

                request.send(JSON.stringify({
                    filename: fileName
                }));

                request.onreadystatechange = function () {
                    if (request.readyState === 4 && request.status === 201) {

                        data = JSON.parse(request.response);
                        fileModel = new FileModel({
                            'fileName': fileName,
                            'fileToken': data['upload'].token
                        });

                        $fileContainer.html(_.template(FileTemplate)(fileModel.toJSON()));
                    }
                };
            }


        });
    });
}).call(this, define || RequireJS.define);
