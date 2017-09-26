"""
Course Goals Views - includes REST API
"""
import json

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.http import JsonResponse
from edx_rest_framework_extensions.authentication import JwtAuthentication
from eventtracking import tracker
from opaque_keys.edx.keys import CourseKey
from openedx.core.lib.api.permissions import IsStaffOrOwner
from rest_framework import permissions, serializers, viewsets, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response

from .api import CourseGoalOption
from .models import CourseGoal

User = get_user_model()


class CourseGoalSerializer(serializers.ModelSerializer):
    """
    Serializes CourseGoal models.
    """
    user = serializers.SlugRelatedField(slug_field='username', queryset=User.objects.all())

    class Meta:
        model = CourseGoal
        fields = ('user', 'course_key', 'goal_key')

    def validate_goal_key(self, value):
        """
        Ensure that the goal_key is valid.
        """
        if value not in CourseGoalOption.get_course_goal_keys():
            raise serializers.ValidationError(
                'Provided goal key, {goal_key}, is not a valid goal key (options= {goal_options}).'.format(
                    goal_key=value,
                    goal_options=[option.value for option in CourseGoalOption],
                )
            )
        return value

    def validate_course_key(self, value):
        """
        Ensure that the course_key is valid.
        """
        course_key = CourseKey.from_string(value)
        if not course_key:
            raise serializers.ValidationError(
                'Provided course_key ({course_key}) does not map to a course.'.format(
                    course_key=course_key
                )
            )
        return course_key


class CourseGoalViewSet(viewsets.ModelViewSet):
    """
    API calls to create and update a course goal.

    **Use Case**
        * Create a new goal for a user.

            Http400 is returned if the format of the request is not correct,
            the course_id or goal is invalid or cannot be found.

        * Update an existing goal for a user

    **Example Requests**
        POST /api/course_goals/v0/course_goals/
            Request data: {"course_key": <course-key>, "goal_key": "<goal-key>", "user": "<username>"}

    """
    authentication_classes = (JwtAuthentication, SessionAuthentication,)
    permission_classes = (permissions.IsAuthenticated, IsStaffOrOwner,)
    queryset = CourseGoal.objects.all()
    serializer_class = CourseGoalSerializer

    def create(self, validated_data):
        """
        Create a new goal if one does not exist, otherwise
        update the existing goal.
        """
        serializer = self.serializer_class(data=validated_data.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = validated_data.user
        course_key = CourseKey.from_string(validated_data.data['course_key'])
        goal_key = validated_data.data['goal_key']
        goal = CourseGoal.objects.filter(user=user.id, course_key=course_key).first()
        if goal:
            goal.goal_key = goal_key
            goal.save(update_fields=['goal_key'])
        else:
            CourseGoal.objects.create(
                user=user,
                course_key=course_key,
                goal_key=goal_key,
            )
        data = {'goal_key': str(goal_key)}
        return JsonResponse(data, content_type="application/json", status=(200 if goal else 201))


@receiver(post_save, sender=CourseGoal, dispatch_uid="emit_course_goals_event")
def emit_course_goal_event(sender, instance, **kwargs):
    name = 'edx.course.goal.added' if kwargs.get('created', False) else 'edx.course.goal.updated'
    tracker.emit(
        name,
        {
            'goal_key': instance.goal_key,
        }
    )
