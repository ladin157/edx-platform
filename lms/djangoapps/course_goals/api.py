"""
Course Goals Python API
"""
from enum import Enum
from opaque_keys.edx.keys import CourseKey
from django.conf import settings
from django.utils.translation import ugettext as _
from openedx.core.djangolib.markup import Text
from rest_framework.reverse import reverse

from .models import CourseGoal
from course_modes.models import CourseMode
from openedx.features.course_experience import ENABLE_COURSE_GOALS
from student.models import CourseEnrollment


def add_course_goal(user, course_id, goal_key):
    """
    Add a new course goal for the provided user and course.

    Arguments:
        user: The user that is setting the goal
        course_id (string): The id for the course the goal refers to
        goal_key (string): The goal key that maps to one of the
            enumerated goal keys from CourseGoalOption.

    """
    # Create and save a new course goal
    course_key = CourseKey.from_string(str(course_id))
    new_goal = CourseGoal(user=user, course_key=course_key, goal_key=goal_key)
    new_goal.save()


def get_course_goal(user, course_key):
    """
    Given a user and a course_key, return their course goal.

    If the user is anonymouse or a course goal does not exist, returns None.
    """
    course_goals = CourseGoal.objects.filter(user=user, course_key=course_key) if not user.is_anonymous() else None
    return course_goals[0] if course_goals else None


def remove_course_goal(user, course_key):
    """
    Given a user and a course_key, remove the course goal.
    """
    course_goal = get_course_goal(user, course_key)
    if course_goal:
        course_goal.delete()


class CourseGoalOption(Enum):
    """
    Types of goals that a user can select.

    These options are set to a string goal key so that they can be
    referenced elsewhere in the code when necessary.
    """
    CERTIFY = 'certify'
    COMPLETE = 'complete'
    EXPLORE = 'explore'
    UNSURE = 'unsure'

    @classmethod
    def get_course_goal_keys(self):
        return [key.value for key in self]


def get_goal_text(goal_option):
    """
    This function is used to translate the course goal option into
    a translated, user-facing string to be used to represent that
    particular goal.
    """
    return {
        CourseGoalOption.CERTIFY.value: Text(_('Earn a certificate')),
        CourseGoalOption.COMPLETE.value: Text(_('Complete the course')),
        CourseGoalOption.EXPLORE.value: Text(_('Explore the course')),
        CourseGoalOption.UNSURE.value: Text(_('Not sure yet')),
    }[goal_option]


def get_goals_api_url(request):
    """
    Returns the endpoint for accessing REST Api.
    """
    return reverse('course_goals_api:v0:course_goal-list', request=request)


def has_course_goal_permission(request, course_id, user_access):
    """
    Returns whether the user can access the course goal functionality.

    Only authenticated, but not yet verified users that are enrolled
    in a verifiable course can use this feature.

    This feature is currently protected by a waffle flag.
    """
    course_key = CourseKey.from_string(course_id)
    has_verified_mode = CourseMode.has_verified_mode(CourseMode.modes_for_course_dict(unicode(course_id)))
    is_already_verified = CourseEnrollment.is_enrolled_as_verified(request.user, course_key)
    return user_access['is_enrolled'] and has_verified_mode and not is_already_verified \
        and ENABLE_COURSE_GOALS.is_enabled(course_key) and settings.FEATURES.get('ENABLE_COURSE_GOALS')
