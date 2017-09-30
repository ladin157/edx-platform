import itertools
from nose.plugins.attrib import attr

import ddt
from capa.tests.response_xml_factory import MultipleChoiceResponseXMLFactory
from courseware.access import has_access
from courseware.tests.test_submitting_problems import ProblemSubmissionTestMixin
from django.conf import settings
from lms.djangoapps.course_blocks.api import get_course_blocks
from lms.djangoapps.grades.config.tests.utils import persistent_grades_feature_flags
from mock import patch
from openedx.core.djangolib.testing.utils import get_mock_request
from openedx.core.djangoapps.content.block_structure.factory import BlockStructureFactory
from student.models import CourseEnrollment
from student.tests.factories import UserFactory
from xmodule.modulestore.tests.django_utils import SharedModuleStoreTestCase
from xmodule.modulestore.tests.factories import CourseFactory, ItemFactory

from ..config.waffle import ASSUME_ZERO_GRADE_IF_ABSENT, waffle
from ..course_grade import CourseGrade, ZeroCourseGrade
from ..course_grade_factory import CourseGradeFactory
from ..subsection_grade import SubsectionGrade, ZeroSubsectionGrade
from ..subsection_grade_factory import SubsectionGradeFactory
from .base import GradeTestBase
from .utils import mock_get_score


@ddt.ddt
class TestCourseGradeFactory(GradeTestBase):
    """
    Test that CourseGrades are calculated properly
    """
    def _assert_zero_grade(self, course_grade, expected_grade_class):
        """
        Asserts whether the given course_grade is as expected with
        zero values.
        """
        self.assertIsInstance(course_grade, expected_grade_class)
        self.assertIsNone(course_grade.letter_grade)
        self.assertEqual(course_grade.percent, 0.0)
        self.assertIsNotNone(course_grade.chapter_grades)

    def test_course_grade_no_access(self):
        """
        Test to ensure a grade can ba calculated for a student in a course, even if they themselves do not have access.
        """
        invisible_course = CourseFactory.create(visible_to_staff_only=True)
        access = has_access(self.request.user, 'load', invisible_course)
        self.assertEqual(access.has_access, False)
        self.assertEqual(access.error_code, 'not_visible_to_user')

        # with self.assertNoExceptionRaised: <- this isn't a real method, it's an implicit assumption
        grade = CourseGradeFactory().read(self.request.user, invisible_course)
        self.assertEqual(grade.percent, 0)

    @patch.dict(settings.FEATURES, {'PERSISTENT_GRADES_ENABLED_FOR_ALL_TESTS': False})
    @ddt.data(
        (True, True),
        (True, False),
        (False, True),
        (False, False),
    )
    @ddt.unpack
    def test_course_grade_feature_gating(self, feature_flag, course_setting):
        # Grades are only saved if the feature flag and the advanced setting are
        # both set to True.
        grade_factory = CourseGradeFactory()
        with persistent_grades_feature_flags(
            global_flag=feature_flag,
            enabled_for_all_courses=False,
            course_id=self.course.id,
            enabled_for_course=course_setting
        ):
            with patch('lms.djangoapps.grades.models.PersistentCourseGrade.read') as mock_read_grade:
                grade_factory.read(self.request.user, self.course)
        self.assertEqual(mock_read_grade.called, feature_flag and course_setting)

    def test_read(self):
        grade_factory = CourseGradeFactory()

        def _assert_read(expected_pass, expected_percent):
            """
            Creates the grade, ensuring it is as expected.
            """
            course_grade = grade_factory.read(self.request.user, self.course)
            self.assertEqual(course_grade.letter_grade, u'Pass' if expected_pass else None)
            self.assertEqual(course_grade.percent, expected_percent)

        with waffle().override(ASSUME_ZERO_GRADE_IF_ABSENT):
            with self.assertNumQueries(1), mock_get_score(1, 2):
                _assert_read(expected_pass=False, expected_percent=0)

            with self.assertNumQueries(10), mock_get_score(1, 2):
                grade_factory.update(self.request.user, self.course)

            with self.assertNumQueries(1):
                _assert_read(expected_pass=True, expected_percent=0.5)

    @patch.dict(settings.FEATURES, {'ASSUME_ZERO_GRADE_IF_ABSENT_FOR_ALL_TESTS': False})
    @ddt.data(*itertools.product((True, False), (True, False)))
    @ddt.unpack
    def test_read_zero(self, assume_zero_enabled, create_if_needed):
        with waffle().override(ASSUME_ZERO_GRADE_IF_ABSENT, active=assume_zero_enabled):
            grade_factory = CourseGradeFactory()
            course_grade = grade_factory.read(self.request.user, self.course, create_if_needed=create_if_needed)
            if create_if_needed or assume_zero_enabled:
                self._assert_zero_grade(course_grade, ZeroCourseGrade if assume_zero_enabled else CourseGrade)
            else:
                self.assertIsNone(course_grade)

    def test_create_zero_subs_grade_for_nonzero_course_grade(self):
        with waffle().override(ASSUME_ZERO_GRADE_IF_ABSENT):
            subsection = self.course_structure[self.sequence.location]
            with mock_get_score(1, 2):
                self.subsection_grade_factory.update(subsection)
            course_grade = CourseGradeFactory().update(self.request.user, self.course)
            subsection1_grade = course_grade.subsection_grades[self.sequence.location]
            subsection2_grade = course_grade.subsection_grades[self.sequence2.location]
            self.assertIsInstance(subsection1_grade, SubsectionGrade)
            self.assertIsInstance(subsection2_grade, ZeroSubsectionGrade)

    @ddt.data(True, False)
    def test_iter_force_update(self, force_update):
        with patch('lms.djangoapps.grades.subsection_grade_factory.SubsectionGradeFactory.update') as mock_update:
            set(CourseGradeFactory().iter(
                users = [self.request.user], course = self.course, force_update = force_update
            ))
        self.assertEqual(mock_update.called, force_update)

    def test_course_grade_summary(self):
        with mock_get_score(1, 2):
            self.subsection_grade_factory.update(self.course_structure[self.sequence.location])
        course_grade = CourseGradeFactory().update(self.request.user, self.course)

        actual_summary = course_grade.summary

        # We should have had a zero subsection grade for sequential 2, since we never
        # gave it a mock score above.
        expected_summary = {
            'grade': None,
            'grade_breakdown': {
                'Homework': {
                    'category': 'Homework',
                    'percent': 0.25,
                    'detail': 'Homework = 25.00% of a possible 100.00%',
                }
            },
            'percent': 0.25,
            'section_breakdown': [
                {
                    'category': 'Homework',
                    'detail': u'Homework 1 - Test Sequential 1 - 50% (1/2)',
                    'label': u'HW 01',
                    'percent': 0.5
                },
                {
                    'category': 'Homework',
                    'detail': u'Homework 2 - Test Sequential 2 - 0% (0/1)',
                    'label': u'HW 02',
                    'percent': 0.0
                },
                {
                    'category': 'Homework',
                    'detail': u'Homework Average = 25%',
                    'label': u'HW Avg',
                    'percent': 0.25,
                    'prominent': True
                },
            ]
        }
        self.assertEqual(expected_summary, actual_summary)


@attr(shard=1)
class TestGradeIteration(SharedModuleStoreTestCase):
    """
    Test iteration through student course grades.
    """
    COURSE_NUM = "1000"
    COURSE_NAME = "grading_test_course"

    @classmethod
    def setUpClass(cls):
        super(TestGradeIteration, cls).setUpClass()
        cls.course = CourseFactory.create(
            display_name=cls.COURSE_NAME,
            number=cls.COURSE_NUM
        )

    def setUp(self):
        """
        Create a course and a handful of users to assign grades
        """
        super(TestGradeIteration, self).setUp()

        self.students = [
            UserFactory.create(username='student1'),
            UserFactory.create(username='student2'),
            UserFactory.create(username='student3'),
            UserFactory.create(username='student4'),
            UserFactory.create(username='student5'),
        ]

    def test_empty_student_list(self):
        """
        If we don't pass in any students, it should return a zero-length
        iterator, but it shouldn't error.
        """
        grade_results = list(CourseGradeFactory().iter([], self.course))
        self.assertEqual(grade_results, [])

    def test_all_empty_grades(self):
        """
        No students have grade entries.
        """
        with patch.object(
            BlockStructureFactory,
            'create_from_store',
            wraps=BlockStructureFactory.create_from_store
        ) as mock_create_from_store:
            all_course_grades, all_errors = self._course_grades_and_errors_for(self.course, self.students)
            self.assertEquals(mock_create_from_store.call_count, 1)

        self.assertEqual(len(all_errors), 0)
        for course_grade in all_course_grades.values():
            self.assertIsNone(course_grade.letter_grade)
            self.assertEqual(course_grade.percent, 0.0)

    @patch('lms.djangoapps.grades.course_grade_factory.CourseGradeFactory.read')
    def test_grading_exception(self, mock_course_grade):
        """Test that we correctly capture exception messages that bubble up from
        grading. Note that we only see errors at this level if the grading
        process for this student fails entirely due to an unexpected event --
        having errors in the problem sets will not trigger this.

        We patch the grade() method with our own, which will generate the errors
        for student3 and student4.
        """

        student1, student2, student3, student4, student5 = self.students
        mock_course_grade.side_effect = [
            Exception("Error for {}.".format(student.username))
            if student.username in ['student3', 'student4']
            else mock_course_grade.return_value
            for student in self.students
        ]
        with self.assertNumQueries(4):
            all_course_grades, all_errors = self._course_grades_and_errors_for(self.course, self.students)
        self.assertEqual(
            {student: all_errors[student].message for student in all_errors},
            {
                student3: "Error for student3.",
                student4: "Error for student4.",
            }
        )

        # But we should still have five gradesets
        self.assertEqual(len(all_course_grades), 5)

        # Even though two will simply be empty
        self.assertIsNone(all_course_grades[student3])
        self.assertIsNone(all_course_grades[student4])

        # The rest will have grade information in them
        self.assertIsNotNone(all_course_grades[student1])
        self.assertIsNotNone(all_course_grades[student2])
        self.assertIsNotNone(all_course_grades[student5])

    def _course_grades_and_errors_for(self, course, students):
        """
        Simple helper method to iterate through student grades and give us
        two dictionaries -- one that has all students and their respective
        course grades, and one that has only students that could not be graded
        and their respective error messages.
        """
        students_to_course_grades = {}
        students_to_errors = {}

        for student, course_grade, error in CourseGradeFactory().iter(students, course):
            students_to_course_grades[student] = course_grade
            if error:
                students_to_errors[student] = error

        return students_to_course_grades, students_to_errors


class TestCourseGradeLogging(ProblemSubmissionTestMixin, SharedModuleStoreTestCase):
    """
    Tests logging in the course grades module.
    Uses a larger course structure than other
    unit tests.
    """
    def setUp(self):
        super(TestCourseGradeLogging, self).setUp()
        self.course = CourseFactory.create()
        with self.store.bulk_operations(self.course.id):
            self.chapter = ItemFactory.create(
                parent=self.course,
                category="chapter",
                display_name="Test Chapter"
            )
            self.sequence = ItemFactory.create(
                parent=self.chapter,
                category='sequential',
                display_name="Test Sequential 1",
                graded=True
            )
            self.sequence_2 = ItemFactory.create(
                parent=self.chapter,
                category='sequential',
                display_name="Test Sequential 2",
                graded=True
            )
            self.sequence_3 = ItemFactory.create(
                parent=self.chapter,
                category='sequential',
                display_name="Test Sequential 3",
                graded=False
            )
            self.vertical = ItemFactory.create(
                parent=self.sequence,
                category='vertical',
                display_name='Test Vertical 1'
            )
            self.vertical_2 = ItemFactory.create(
                parent=self.sequence_2,
                category='vertical',
                display_name='Test Vertical 2'
            )
            self.vertical_3 = ItemFactory.create(
                parent=self.sequence_3,
                category='vertical',
                display_name='Test Vertical 3'
            )
            problem_xml = MultipleChoiceResponseXMLFactory().build_xml(
                question_text='The correct answer is Choice 2',
                choices=[False, False, True, False],
                choice_names=['choice_0', 'choice_1', 'choice_2', 'choice_3']
            )
            self.problem = ItemFactory.create(
                parent=self.vertical,
                category="problem",
                display_name="test_problem_1",
                data=problem_xml
            )
            self.problem_2 = ItemFactory.create(
                parent=self.vertical_2,
                category="problem",
                display_name="test_problem_2",
                data=problem_xml
            )
            self.problem_3 = ItemFactory.create(
                parent=self.vertical_3,
                category="problem",
                display_name="test_problem_3",
                data=problem_xml
            )
        self.request = get_mock_request(UserFactory())
        self.client.login(username=self.request.user.username, password="test")
        self.course_structure = get_course_blocks(self.request.user, self.course.location)
        self.subsection_grade_factory = SubsectionGradeFactory(self.request.user, self.course, self.course_structure)
        CourseEnrollment.enroll(self.request.user, self.course.id)
