''' 
todo:

make webscrapers for courses page

Link to course catalog:
https://catalog.charlotte.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D=1&cur_cat_oid=38&expand=1&navoid=4596&print=1#acalog_template_course_filter

'''

import requests
from bs4 import BeautifulSoup
import re
import sqlite3

class DatabaseManager:
    def __init__(self, db_name='MajorMap.db'):
        self.db_name = db_name
        self.conn = None
        self.cur = None
        
    def connect(self):
        self.conn = sqlite3.connect(self.db_name)
        self.cur = self.conn.cursor()

    def close(self):
        if self.conn:
            self.cur.close()
            self.conn.close()

    def create_db(self):
        conn = sqlite3.connect('MajorMap.db')
        cur = conn.cursor()

        #credits can be in different formats such as individual integer or range.
        courses_table = '''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            number TEXT NOT NULL,
            credits TEXT,
            description TEXT,
            restrictions TEXT
        );'''

        #type can be "prerequisite", "corequisite", or "pre_or_co".
        #choice_group is nullable, the relationship can not be in a choice set.
        relationships_table = '''
        CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY,
            target_course_id INTEGER NOT NULL,
            related_course_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            choice_group INTEGER, 
            FOREIGN KEY (target_course_id) REFERENCES courses(id),
            FOREIGN KEY (related_course_id) REFERENCES courses(id)
        );'''

        cur.execute(courses_table)
        cur.execute(relationships_table)
        conn.commit()
        cur.close()
        conn.close()

    def add_courses(self, courses):
        self.connect()
        self.cur.executemany('INSERT INTO courses (name, subject, number, credits, description, restrictions) VALUES (?, ?, ?, ?, ?, ?)',
                        [(course.name, course.subject, course.number, course.credits, course.description, course.restrictions) for course in courses])
        self.conn.commit()
        self.close()

'''
load courses first so that all courses have an id.
then load relationships such that for each target course, the related course already has an id which can be retrieved.

put each course in courses
now courses table is done

go through course catalog
for each course, read prerequisites/corequisites line
if there exists relationship, break down into comprehensive set, choice set
for each related course in comprehensive set, add to relationships table
for each choice set, add it to relationships with corresponding id which is incremented
now relationships table is done
'''

class Course:
    def __init__(self, name, subject, number, description=None, credits=None, restrictions=None):
        self.name = name
        self.subject = subject
        self.number = number
        self.description = description
        self.credits = credits
        self.restrictions = restrictions

class CourseParser:

    courses = []

    @staticmethod
    def get_courses(first_page, last_page):
    
        base_url = "https://catalog.charlotte.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D={page}&cur_cat_oid=38&expand=1&navoid=4596&print=1#acalog_template_course_filter"
        course_data = []

        for page in range(first_page, last_page + 1):
            url = base_url.format(page=page)
            response = requests.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')

            page_course_data = soup.findAll('td', class_='width')
            course_data.extend(page_course_data)

        return course_data
    
    @staticmethod
    def load_courses(first_page, last_page):
        course_data = CourseParser.get_courses(first_page, last_page)
        load_num = 0

        for course in course_data:
            load_num += 1
            
            course_text = course.find('h3').get_text(strip=True).split(' - ')
            course_name = course_text[1]
            course_text = course_text[0].split(' ')
            course_subject = course_text[0]
            course_number = course_text[1]
            description_text = course.find('hr')
            description = (
                description_text.next_sibling.strip()
                if description_text and isinstance(description_text.next_sibling, str)
                else None
            )
        
            credits_text = course.find('strong', string="Credit Hours:")

            credits = (
                credits_text.next_sibling.strip()
                if credits_text and isinstance(credits_text.next_sibling, str)
                else None
            )

            restrictions_text = course.find('strong', string="Restriction(s):")

            restrictions = (
                restrictions_text.next_sibling.strip()
                if restrictions_text and isinstance(restrictions_text.next_sibling, str)
                else None
            )

            CourseParser.courses.append(Course(course_name, course_subject, course_number, description, credits, restrictions))
            if load_num % 100 == 0:
                print(load_num)

    @staticmethod
    def extract_visible_text(elements):
        visible_text = []
        for element in elements:
            if isinstance(element, str):
                visible_text.append(element.strip())
            elif hasattr(element, 'get_text'):
                style = element.attrs.get('style', '')
                if 'display: none' not in style and 'visiblity: hidden' not in style:
                    visible_text.append(element.get_text(strip=True))

        return ' '.join(filter(None, visible_text))

    @staticmethod
    def get_requirements(start_page, end_page):
            course_data = CourseParser.get_courses(start_page, end_page)
            
            for course in course_data[:4]:

                prerequisites = None
                corequisites = None
                pre_or_corequisites = None

                prerequisites_text = course.find('strong', string="Prerequisite(s):")

                if prerequisites_text:
                    siblings = []
                    current = prerequisites_text.next_sibling

                    while current and (not hasattr(current, 'name') or current.name != 'br'):
                        siblings.append(current)
                        current = current.next_sibling

                    prerequisites = CourseParser.extract_visible_text(siblings)

                corequisites_text = course.find('strong', string="Corequisite(s):")

                if corequisites_text:
                    siblings = []
                    current = corequisites_text.next_sibling

                    while current and (not hasattr(current, 'name') or current.name != 'br'):
                        siblings.append(current)
                        current = current.next_sibling

                    corequisites = CourseParser.extract_visible_text(siblings)

                pre_or_corequisites_text = course.find('strong', string="Pre- or Corequisite(s):")

                if pre_or_corequisites_text:
                    siblings = []
                    current = pre_or_corequisites_text.next_sibling

                    while current and (not hasattr(current, 'name') or current.name != 'br'):
                        siblings.append(current)
                        current = current.next_sibling

                    pre_or_corequisites = CourseParser.extract_visible_text(siblings)

                print(prerequisites)
                print(corequisites)
                print(pre_or_corequisites)





'''
get course_data
for each course, and for each of these sections, if there is one, between the <br> tags
    prerequisites
    corequisites
    pre- or corequisites

take text that follows (list of course requirements)
use natural language processing to take in text, output the comprehensive set and choice sets
'''
            
if __name__ == "__main__":
    
    db = DatabaseManager()

    CourseParser.get_requirements(4, 4)
