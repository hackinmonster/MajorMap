import sqlite3

def test_prereq(subject, number):

    conn = sqlite3.connect('courses.db')
    cur = conn.cursor()

    find_prereq_query = '''
                                select 
                                    courses.subject || ' ' || courses.number as course_tag
                                from
                                    relationships
                                left join
                                    courses on relationships.prerequisite = courses.id
                                where
                                    requisite = (
                                        select id from courses where subject = ? and number = ?
                                    )
                                '''

    cur.execute(find_prereq_query, (subject, number))
    prereq_list = cur.fetchall()
    print(prereq_list)

    cur.close()
    conn.close()

test_prereq('MEGR', '3171L')
