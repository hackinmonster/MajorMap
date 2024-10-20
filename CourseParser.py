import requests
from bs4 import BeautifulSoup
import re
import sqlite3
from Course import Course
from CourseManager import CourseManager as cm

class CourseParser:
    @staticmethod
    def load_courses_from_page(page):
        base_url = "https://catalog.charlotte.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D=" + str(page) + "&cur_cat_oid=38&expand=1&navoid=4596&print=1#acalog_template_course_filter"
        response = requests.get(base_url)
        soup = BeautifulSoup(response.text, 'html.parser')

        course_data = soup.findAll('td', class_='width')
        course_id = 0

        for course in course_data:
            course_text = course.find('h3').get_text(strip=True).split(' - ')
            course_name = course_text[1]
            course_text = course_text[0].split(' ')
            course_subject = course_text[0]
            course_number = course_text[1]
            course_id += 1

            new_course = Course(course_id, course_name, course_subject, course_number)
            cm.courses.append(new_course)

    @staticmethod
    def load_relationships_from_page(page):
        base_url = "https://catalog.charlotte.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D=" + str(page) + "&cur_cat_oid=38&expand=1&navoid=4596&print=1#acalog_template_course_filter"
        response = requests.get(base_url)
        soup = BeautifulSoup(response.text, 'html.parser')

        course_data = soup.findAll('td', class_='width')

        conn = sqlite3.connect('courses.db')
        cur = conn.cursor()


        for course in course_data:
            course_text = course.find('h3').get_text(strip=True).split(' - ')
            course_text = course_text[0].split(' ')
            course_subject = course_text[0]
            course_number = course_text[1]


            course_pattern = r'\b[A-Z]{4} \d{4}L?\b'
            prereq_section = course.find('strong', string="Prerequisite(s):")

            if prereq_section is not None:

                prereq_text = ' '.join(sibling.text.strip() for sibling in prereq_section.find_next_siblings('a'))
                prereqs = re.findall(course_pattern, prereq_text)

                find_id_query = '''
                    SELECT id FROM courses WHERE subject = ? AND number = ?
                    '''

                for prereq in prereqs:

                    prereq_parts = prereq.split(' ')
                    prereq_subject = prereq_parts[0]
                    prereq_number = prereq_parts[1]

                    cur.execute(find_id_query, (prereq_subject, prereq_number))
                    prereq_id = cur.fetchone()
                    if prereq_id is not None:
                        prereq_id = prereq_id[0]

                    cur.execute(find_id_query, (course_subject, course_number))
                    course_id = cur.fetchone()
                    if course_id is not None:
                        course_id = course_id[0]

                    cur.execute('''
                        INSERT INTO relationships (prerequisite, requisite, co_requisite1, co_requisite2)
                        VALUES (?, ?, ?, ?)
                    ''', (prereq_id, course_id, None, None))
                    conn.commit()

        cur.close()
        conn.close()

                            

    @staticmethod
    def load_all_courses(pages):
        for page in range(1, pages + 1):
            CourseParser.load_courses_from_page(page)
        
    @staticmethod
    def load_all_relationships(pages):
        for page in range(1, pages + 1):
            CourseParser.load_relationships_from_page(page)

