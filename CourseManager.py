import sqlite3

class CourseManager:

    def __init__(self):
        self.courses = []

    @staticmethod
    def get_ids_list(course_list):

        conn = sqlite3.connect('courses.db')
        cur = conn.cursor()

        ids_list = []

        for course in course_list:
            course_tag = course.split(' ')
            course_subject = course_tag[0]
            course_number = course_tag[1]

            find_id_query = '''
                        SELECT id FROM courses WHERE subject = ? AND number = ?
                        '''
            cur.execute(find_id_query, (course_subject, course_number))
            course_id = cur.fetchone()
            
            if course_id is not None:
                course_id = course_id[0] 
                ids_list.append(course_id)

        cur.close()
        conn.close()

        return ids_list