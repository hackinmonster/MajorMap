import sqlite3

class DatabaseManager:
    def __init__(self, db_name='courses.db'):
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

    def create_db():
        conn = sqlite3.connect('courses.db')
        cur = conn.cursor()

        courses_table = '''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            number TEXT NOT NULL
        );'''

        relationships_table = '''
        CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prerequisite INTEGER,
            requisite INTEGER,
            co_requisite1 INTEGER,
            co_requisite2 INTEGER,
            FOREIGN KEY (prerequisite) REFERENCES courses(id),
            FOREIGN KEY (requisite) REFERENCES courses(id),
            FOREIGN KEY (co_requisite1) REFERENCES courses(id),
            FOREIGN KEY (co_requisite2) REFERENCES courses(id)
        );'''

        cur.execute(courses_table)
        cur.execute(relationships_table)
        conn.commit()
        cur.close()
        conn.close()

    
    def add_courses(self, courses):
        conn = self.create_connection()
        cur = conn.cursor()
        cur.executemany('INSERT INTO courses (name, subject, number) VALUES (?, ?, ?)',
                        [(course.name, course.subject, course.number) for course in courses])
        conn.commit()
        cur.close()
        conn.close()

    def search_takeable_courses(self, courses_taken):
        pass
        


    
