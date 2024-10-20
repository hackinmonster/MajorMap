import sqlite3
from CourseParser import CourseParser as cp
from CourseManager import CourseManager as cm
from Course import Course

class Test:

    #id
    #name
    #subject
    #number

    @staticmethod
    def add_em_1(pages):
        cp.load_all_courses(pages) #last page

        cm.create_db()

        cm.add_courses_to_db(cm.courses)

    @staticmethod
    def create_rels_table():
        cm.create_relationships_table()

    @staticmethod
    def check_em_1(search_name):

        conn = sqlite3.connect('courses.db')
        cur = conn.cursor()

        cur.execute("SELECT name FROM courses WHERE name LIKE ?", ('%' + search_name + '%',))

        print(cur.fetchall())

        cur.close()
        conn.close()

    @staticmethod
    def check_prereqs():
        cp.load_requisites_from_page(1)



