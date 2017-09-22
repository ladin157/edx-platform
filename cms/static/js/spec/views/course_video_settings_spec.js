define(
    ['jquery', 'underscore', 'backbone', 'edx-ui-toolkit/js/utils/spec-helpers/ajax-helpers',
        'js/views/course_video_settings', 'common/js/spec_helpers/template_helpers'],
    function($, _, Backbone, AjaxHelpers, CourseVideoSettingsView, TemplateHelpers) {
        'use strict';
        describe('CourseVideoSettingsView', function() {
            var $courseVideoSettingsEl,
                courseVideoSettingsView,
                renderCourseVideoSettingsView,
                destroyCourseVideoSettingsView,
                verifyPreferanceErrorState,
                resetProvider,
                changeProvider,
                transcriptPreferencesUrl = '/transcript_preferences/course-v1:edX+DemoX+Demo_Course',
                transcriptOrgCredentialsHandlerUrl = '/transcript_org_credentials/course-v1:edX+DemoX+Demo_Course',
                activeTranscriptPreferences = {
                    provider: 'Cielo24',
                    cielo24_fidelity: 'PROFESSIONAL',
                    cielo24_turnaround: 'PRIORITY',
                    three_play_turnaround: '',
                    video_source_language: '',
                    preferred_languages: ['fr', 'en'],
                    modified: '2017-08-27T12:28:17.421260Z'
                },
                transcriptOrganizationCredentials = {
                    Cielo24: true,
                    '3PlayMedia': true
                },
                transcriptionPlans = {
                    '3PlayMedia': {
                        languages: {
                            fr: 'French',
                            en: 'English'
                        },
                        turnaround: {
                            default: '4-Day/Default',
                            same_day_service: 'Same Day',
                            rush_service: '24-hour/Rush',
                            extended_service: '10-Day/Extended',
                            expedited_service: '2-Day/Expedited'
                        },
                        display_name: '3PlayMedia'
                    },
                    Cielo24: {
                        turnaround: {
                            PRIORITY: 'Priority, 24h',
                            STANDARD: 'Standard, 48h'
                        },
                        fidelity: {
                            PROFESSIONAL: {
                                languages: {
                                    ru: 'Russian',
                                    fr: 'French',
                                    en: 'English'
                                },
                                display_name: 'Professional, 99% Accuracy'
                            },
                            PREMIUM: {
                                languages: {
                                    en: 'English'
                                },
                                display_name: 'Premium, 95% Accuracy'
                            },
                            MECHANICAL: {
                                languages: {
                                    fr: 'French',
                                    en: 'English',
                                    nl: 'Dutch'
                                },
                                display_name: 'Mechanical, 75% Accuracy'
                            }
                        },
                        display_name: 'Cielo24'
                    }
                };

            renderCourseVideoSettingsView = function(activeTranscriptPreferencesData, transcriptionPlansData, transcriptOrganizationCredentialsData) {
                // First destroy old referance to the view if present.
                destroyCourseVideoSettingsView();

                courseVideoSettingsView = new CourseVideoSettingsView({
                    activeTranscriptPreferences: activeTranscriptPreferencesData || null,
                    videoTranscriptSettings: {
                        transcript_preferences_handler_url: transcriptPreferencesUrl,
                        transcript_org_credentials_handler_url: transcriptOrgCredentialsHandlerUrl,
                        transcription_plans: transcriptionPlansData || null
                    },
                    transcriptOrganizationCredentials: transcriptOrganizationCredentialsData || null
                });
                $courseVideoSettingsEl = courseVideoSettingsView.render().$el;
            };

            destroyCourseVideoSettingsView = function() {
                if (courseVideoSettingsView) {
                    courseVideoSettingsView.closeCourseVideoSettings();
                    courseVideoSettingsView = null;
                }
            };

            verifyPreferanceErrorState = function($preferanceContainerEl, hasError) {
                var $errorIconHtml = hasError ? '<span class="icon fa fa-info-circle" aria-hidden="true"></span>' : '',
                    requiredText = hasError ? 'Required' : '';
                expect($preferanceContainerEl.hasClass('error')).toEqual(hasError);
                expect($preferanceContainerEl.find('.error-icon').html()).toEqual($errorIconHtml);
                expect($preferanceContainerEl.find('.error-info').html()).toEqual(requiredText);
            };

            changeProvider = function(selectedProvider) {
                courseVideoSettingsView.providerSelected({
                    target: {
                        value: selectedProvider
                    }
                });
            };

            resetProvider = function() {
                var requests = AjaxHelpers.requests(this);

                // Set no provider selected
                courseVideoSettingsView.selectedProvider = '';
                $courseVideoSettingsEl.find('.action-update-course-video-settings').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'DELETE',
                    transcriptPreferencesUrl
                );

                // Send successful empty content response.
                AjaxHelpers.respondWithJson(requests, {});
            };

            beforeEach(function() {
                setFixtures(
                    '<div class="video-transcript-settings-wrapper"></div>' +
                    '<button class="button course-video-settings-button"></button>'
                );
                TemplateHelpers.installTemplate('course-video-settings');
                renderCourseVideoSettingsView(activeTranscriptPreferences, transcriptionPlans);
            });

            afterEach(function() {
                destroyCourseVideoSettingsView();
            });

            it('renders as expected', function() {
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).toExist();
            });

            it('closes course video settings pane when close button is clicked', function() {
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).toExist();
                $courseVideoSettingsEl.find('.action-close-course-video-settings').click();
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).not.toExist();
            });

            it('closes course video settings pane when clicked outside course video settings pane', function() {
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).toExist();
                $('body').click();
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).not.toExist();
            });

            it('does not close course video settings pane when clicked inside course video settings pane', function() {
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).toExist();
                $courseVideoSettingsEl.find('.transcript-provider-group').click();
                expect($courseVideoSettingsEl.find('.course-video-settings-container')).toExist();
            });

            it('does not populate transcription plans if transcription plans are not provided', function() {
                // Create view with empty data.
                renderCourseVideoSettingsView();

                expect($courseVideoSettingsEl.find('.course-video-transcript-preferances-wrapper').html()).toEqual('');
            });

            it('populates transcription plans correctly', function() {
                // Only check transcript-provider radio buttons for now, because other preferances are based on either
                // user selection or activeTranscriptPreferences.
                expect($courseVideoSettingsEl.find('.transcript-provider-group').html()).not.toEqual('');
            });

            it('populates active preferances correctly', function() {
                // First check preferance are selected correctly in HTML.
                expect($courseVideoSettingsEl.find('.selected-transcript-provider span').html()).toEqual(
                    activeTranscriptPreferences.provider
                );
                expect($courseVideoSettingsEl.find('#transcript-turnaround').val()).toEqual(
                    activeTranscriptPreferences.cielo24_turnaround
                );
                expect($courseVideoSettingsEl.find('#transcript-fidelity').val()).toEqual(
                    activeTranscriptPreferences.cielo24_fidelity
                );
                expect($courseVideoSettingsEl.find('.transcript-language-container').length).toEqual(
                    activeTranscriptPreferences.preferred_languages.length
                );

                // Now check values are assigned correctly.
                expect(courseVideoSettingsView.selectedProvider, activeTranscriptPreferences.provider);
                expect(courseVideoSettingsView.selectedTurnaroundPlan, activeTranscriptPreferences.cielo24_turnaround);
                expect(courseVideoSettingsView.selectedFidelityPlan, activeTranscriptPreferences.cielo24_fidelity);
                expect(courseVideoSettingsView.selectedLanguages, activeTranscriptPreferences.preferred_languages);
            });

            it('saves transcript settings on update settings button click if preferances are selected', function() {
                var requests = AjaxHelpers.requests(this);
                $courseVideoSettingsEl.find('.action-update-course-video-settings').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'POST',
                    transcriptPreferencesUrl,
                    JSON.stringify({
                        provider: activeTranscriptPreferences.provider,
                        cielo24_fidelity: activeTranscriptPreferences.cielo24_fidelity,
                        cielo24_turnaround: activeTranscriptPreferences.cielo24_turnaround,
                        three_play_turnaround: activeTranscriptPreferences.three_play_turnaround,
                        preferred_languages: activeTranscriptPreferences.preferred_languages,
                        video_source_language: activeTranscriptPreferences.video_source_language,
                        global: false
                    })
                );

                // Send successful response.
                AjaxHelpers.respondWithJson(requests, {
                    transcript_preferences: activeTranscriptPreferences
                });

                // Verify that success message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.success').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-check-circle" aria-hidden="true"></span>' +
                    '<span>Settings updated</span>' +
                    '</div>'
                );
            });

            it('removes transcript settings on update settings button click when no provider is selected', function() {
                // Reset to N/A provider
                resetProvider();
                // Verify that success message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.success').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-check-circle" aria-hidden="true"></span>' +
                    '<span>Settings updated</span>' +
                    '</div>'
                );
            });

            it('shows error message if server sends error', function() {
                var requests = AjaxHelpers.requests(this);
                $courseVideoSettingsEl.find('.action-update-course-video-settings').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'POST',
                    transcriptPreferencesUrl,
                    JSON.stringify({
                        provider: activeTranscriptPreferences.provider,
                        cielo24_fidelity: activeTranscriptPreferences.cielo24_fidelity,
                        cielo24_turnaround: activeTranscriptPreferences.cielo24_turnaround,
                        three_play_turnaround: activeTranscriptPreferences.three_play_turnaround,
                        preferred_languages: activeTranscriptPreferences.preferred_languages,
                        video_source_language: activeTranscriptPreferences.video_source_language,
                        global: false
                    })
                );

                // Send error response.
                AjaxHelpers.respondWithError(requests, 400, {
                    error: 'Error message'
                });

                // Verify that error message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.error').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-info-circle" aria-hidden="true"></span>' +
                    '<span>Error message</span>' +
                    '</div>'
                );
            });

            it('implies preferences are required if not selected when saving preferances', function() {
                // Reset so that no preferance is selected.
                courseVideoSettingsView.selectedTurnaroundPlan = '';
                courseVideoSettingsView.selectedFidelityPlan = '';
                courseVideoSettingsView.selectedLanguages = [];

                $courseVideoSettingsEl.find('.action-update-course-video-settings').click();

                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-turnaround-wrapper'), true);
                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-fidelity-wrapper'), true);
                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-languages-wrapper'), true);
            });

            it('removes error state on preferances if selected', function() {
                // Provide values for preferances.
                $courseVideoSettingsEl.find('#transcript-turnaround').val('test-value');
                $courseVideoSettingsEl.find('#transcript-fidelity').val('test-value');
                $courseVideoSettingsEl.find('#transcript-language-menu').val('test-value');

                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-turnaround-wrapper'), false);
                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-fidelity-wrapper'), false);
                verifyPreferanceErrorState($courseVideoSettingsEl.find('.transcript-languages-wrapper'), false);
            });

            it('shows provider selected view if active provider is present', function() {
                var $selectedProviderContainerEl = $courseVideoSettingsEl.find('.transcript-provider-wrapper .selected-transcript-provider');
                expect($selectedProviderContainerEl.find('span').html()).toEqual(courseVideoSettingsView.selectedProvider);
                expect($selectedProviderContainerEl.find('button.action-change-provider')).toExist();
                // Verify provider list view is not shown.
                expect($courseVideoSettingsEl.find('.transcript-provider-wrapper .transcript-provider-group')).not.toExist();
            });

            it('does not show transcript preferences or organization credentials if N/A provider is saved', function() {
                var $transcriptProvidersListEl;

                renderCourseVideoSettingsView(null, transcriptionPlans);

                // Check N/A provider
                changeProvider('');

                $transcriptProvidersListEl = $courseVideoSettingsEl.find('.transcript-provider-wrapper .transcript-provider-group');
                expect($transcriptProvidersListEl.find('input[type=radio]').length).toEqual(3);
                // Verify selected provider view is not shown.
                expect($courseVideoSettingsEl.find('.transcript-provider-wrapper .selected-transcript-provider')).not.toExist();
            });

            it('does not show transcript preferences or organization credentials if N/A provider is checked', function() {
                var $transcriptProvidersListEl;

                renderCourseVideoSettingsView(null, transcriptionPlans);

                // Check N/A provider
                changeProvider('');

                $transcriptProvidersListEl = $courseVideoSettingsEl.find('.transcript-provider-wrapper .transcript-provider-group');
                expect($transcriptProvidersListEl.find('input[type=radio]').length).toEqual(3);

                // Verify selected provider view is not shown.
                expect($courseVideoSettingsEl.find('.transcript-provider-wrapper .selected-transcript-provider')).not.toExist();
                // Verify transcript preferences are not shown.
                expect($courseVideoSettingsEl.find('.course-video-transcript-preferances-wrapper:visible')).not.toExist();
                // Verify org credentials are not shown.
                expect($courseVideoSettingsEl.find('.organization-credentials-wrapper:visible')).not.toExist();
            });

            it('shows organization credentials when organization credentials for selected provider are not present', function() {
                renderCourseVideoSettingsView(null, transcriptionPlans);

                // Check Cielo24 provider
                changeProvider('Cielo24');

                // Verify organization credentials are shown.
                expect($courseVideoSettingsEl.find('.organization-credentials-wrapper:visible')).toExist();

                // Verify transcript preferences are not shown.
                expect($courseVideoSettingsEl.find('.course-video-transcript-preferances-wrapper:visible')).not.toExist();
            });

            it('shows transcript preferences when organization credentials for selected provider are present', function() {
                renderCourseVideoSettingsView(null, transcriptionPlans, transcriptOrganizationCredentials);

                // Check Cielo24 provider
                changeProvider('Cielo24');

                // Verify organization credentials are not shown.
                expect($courseVideoSettingsEl.find('.organization-credentials-wrapper:visible')).not.toExist();

                // Verify transcript preferences are shown.
                expect($courseVideoSettingsEl.find('.course-video-transcript-preferances-wrapper:visible')).toExist();
            });

            it('shows organization credentials view if clicked on change provider button', function() {
                // Verify organization credentials view is not shown initially.
                expect($courseVideoSettingsEl.find('.organization-credentials-content')).not.toExist();

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Verify organization credentials is now shown.
                expect($courseVideoSettingsEl.find('.organization-credentials-content')).toExist();
            });

            it('shows api secret input field if selected provider is 3Play Media', function() {
                // Set selected provider to 3Play Media
                courseVideoSettingsView.selectedProvider = '3PlayMedia';

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Verify 3play api secret is present.
                expect(
                    $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-secret')
                ).toExist();

                // Also verify api key is present.
                expect(
                    $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key')
                ).toExist();
            });

            it('does not show api secret input field if selected provider is not 3Play Media', function() {
                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Verify 3Play Media api secret is not present.
                 expect(
                     $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-secret')
                 ).not.toExist();

                // Also verify api key is present.
                expect(
                    $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key')
                ).toExist();
            });

            it('shows warning message when changing organization credentials if present already', function() {
                // Set selectedProvider organization credentials.
                courseVideoSettingsView.transcriptOrganizationCredentials[courseVideoSettingsView.selectedProvider] = true;

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Verify warning message is shown.
                expect($courseVideoSettingsEl.find('.transcription-account-details.warning')).toExist();
            });

            it('does not show warning message when changing organization credentials if not present already', function() {
                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Verify warning message is not shown.
                expect($courseVideoSettingsEl.find('.transcription-account-details.warning')).not.toExist();
            });

            it('shows validation errors if no organization credentials are provided when saving credentials', function() {
                // Set selected provider to 3Play Media
                courseVideoSettingsView.selectedProvider = '3PlayMedia';

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Click save organization credentials button to save credentials.
                $courseVideoSettingsEl.find('.action-update-org-credentials').click();

                verifyPreferanceErrorState(
                    $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key-wrapper'),
                    true
                );

                verifyPreferanceErrorState(
                    $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-secret-wrapper'),
                    true
                );
            });

            it('saves organization credentials on clicking save credentials button', function() {
                var requests = AjaxHelpers.requests(this);

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Set organization credentials so as to pass validations.
                $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key').val('testkey');

                // Click save organization credentials button to save credentials.
                $courseVideoSettingsEl.find('.action-update-org-credentials').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'POST',
                    transcriptOrgCredentialsHandlerUrl,
                    JSON.stringify({
                        provider: activeTranscriptPreferences.provider,
                        global: false
                    })
                );

                // Send empty response.
                AjaxHelpers.respondWithJson(requests, {});

                // Verify that success message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.success').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-check-circle" aria-hidden="true"></span>' +
                    '<span>' + transcriptionPlans[courseVideoSettingsView.selectedProvider].display_name +
                    ' credentials saved</span>' +
                    '</div>'
                );
            });

            it('shows selected provider view afer organization credentials saved', function() {
                var requests = AjaxHelpers.requests(this);
                renderCourseVideoSettingsView(null, transcriptionPlans);

                // Verify selected provider view is not shown.
                expect(
                    $courseVideoSettingsEl.find('.transcript-provider-wrapper .selected-transcript-provider')
                ).not.toExist();

                // Verify provider list view is shown.
                expect(
                    $courseVideoSettingsEl.find('.transcript-provider-wrapper .transcript-provider-group')
                ).toExist();

                // Check Cielo24 provider
                changeProvider('Cielo24');

                // Set organization credentials so as to pass validations.
                $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key').val('testkey');

                // Click save organization credentials button to save credentials.
                $courseVideoSettingsEl.find('.action-update-org-credentials').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'POST',
                    transcriptOrgCredentialsHandlerUrl,
                    JSON.stringify({
                        provider: activeTranscriptPreferences.provider,
                        global: false
                    })
                );

                // Send empty response.
                AjaxHelpers.respondWithJson(requests, {});

                // Verify that success message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.success').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-check-circle" aria-hidden="true"></span>' +
                    '<span>' + transcriptionPlans[courseVideoSettingsView.selectedProvider].display_name +
                    ' credentials saved</span>' +
                    '</div>'
                );

                // Shows selected provider view after credentials are saved.
                expect(
                    $courseVideoSettingsEl.find('.transcript-provider-wrapper .selected-transcript-provider')
                ).toExist();

                // Verify provider list view is not shown.
                expect(
                    $courseVideoSettingsEl.find('.transcript-provider-wrapper .transcript-provider-group')
                ).not.toExist();
            });

            it('shows error message on saving organization credentials if server sends error', function() {
                var requests = AjaxHelpers.requests(this);

                // Click change button to render organization credentials view.
                $courseVideoSettingsEl.find('.action-change-provider').click();

                // Set organization credentials so as to pass validations.
                $courseVideoSettingsEl.find('.' + courseVideoSettingsView.selectedProvider + '-api-key').val('testkey');

                // Click save organization credentials button to save credentials.
                $courseVideoSettingsEl.find('.action-update-org-credentials').click();

                AjaxHelpers.expectRequest(
                    requests,
                    'POST',
                    transcriptOrgCredentialsHandlerUrl,
                    JSON.stringify({
                        provider: activeTranscriptPreferences.provider,
                        global: false
                    })
                );

                // Send error response.
                AjaxHelpers.respondWithError(requests, 400, {
                    error: 'Error message'
                });

                // Verify that error message is shown.
                expect($courseVideoSettingsEl.find('.course-video-settings-message-wrapper.error').html()).toEqual(
                    '<div class="course-video-settings-message">' +
                    '<span class="icon fa fa-info-circle" aria-hidden="true"></span>' +
                    '<span>Error message</span>' +
                    '</div>'
                );
            });

            // TODO: Add more tests like clicking on add language, remove and their scenarios and some other tests
            // for specific preferance selected tests etc.
        });
    }
);
