import graphviz
import CourseManager as cm
import sqlite3

major = graphviz.Digraph(comment='Major Major')

major.attr(rankdir='LR', size='10,5', dpi='500')

ds_core = [
    'DTSC 1301',
    'DTSC 1302',
    'DTSC 2301',
    'DTSC 2302',
    'DTSC 3601',
    'DTSC 3602',
    'STAT 1220',
    'MATH 2164',
    'STAT 2223',
    'STAT 3160',
    'ITSC 2175',
    'ITSC 1213',
    'ITSC 2214',
    'ITCS 3160',
    'ITCS 3162',
    'DTSC 4301',
    'DTSC 4302'
]

mecheng = [
    'CHEM 1251',
    'CHEM 1251L',
    'MATH 1241',
    'MATH 1242',
    'MATH 2171',
    'MATH 2241',
    'PHYS 2101',
    'PHYS 2101L',
    'PHYS 2102',
    'PHYS 2102L',
    'ECGR 2161',
    'ENGR 1201',
    'ENGR 1202',
    'ENGR 3295',
    'MEGR 2141',
    'MEGR 2144',
    'MEGR 2156',
    'MEGR 2180',
    'MEGR 2240',
    'MEGR 3111',
    'MEGR 3112',
    'MEGR 3114',
    'MEGR 3116',
    'MEGR 3121',
    'MEGR 3122',
    'MEGR 3152',
    'MEGR 3156',
    'MEGR 3161',
    'MEGR 3171',
    'MEGR 3171L',
    'MEGR 3251',
    'MEGR 3255',
    'MEGR 3256',
    ]

chem = [
    'MATH 1241',
    'MATH 1242',
    'CHEM 1251',
    'CHEM 1251L',
    'CHEM 1252',
    'CHEM 1252L',
    'CHEM 4695',
    'CHEM 4696',
    'CHEM 1251',
    'CHEM 1251L',
    'CHEM 1252',
    'CHEM 1252L',
    'CHEM 2131',
    'CHEM 2131L',
    'CHEM 2132',
    'CHEM 2132L',
    'CHEM 2136L',
    'CHEM 3111',
    'CHEM 3141',
    'CHEM 3141L',
    'CHEM 3142',
    'CHEM 3142L',
    'CHEM 3695',
    'CHEM 4111',
    'CHEM 4121',
    'CHEM 4133',
    'CHEM 4165',
    'CHEM 4695',
    'CHEM 4696',
    'CHEM 4900',
    'MATH 1241',
    'MATH 1242',
    'MATH 2241',
    'MATH 2242',
    'MATH 2164',
    'MATH 2171',
    'STAT 3128',
    'PHYS 2101',
    'PHYS 2101L',
    'PHYS 2102',
    'PHYS 2102L',
    ]

python_ds = [
    'ITSC 1212',
    'ITSC 1213',
    'ITSC 1600',
    'ITSC 2175',
    'MATH 2165',
    'ITSC 2181',
    'ITSC 2214',
    'ITSC 3146',
    'ITSC 3155',
    'ITSC 3688',
    'MATH 2164',
    'STAT 2122',
    'ITCS 3160',
    'ITCS 3162',
    'ITCS 3156',
    'ITCS 3190',
    'ITCS 3216',
    'ITCS 4114',
    'ITCS 4121',
    'ITCS 4122',
    'ITCS 4152',
    'INFO 3236',
    'ITIS 4310'
]


major_courses = mecheng

major_courses_ids = cm.CourseManager.get_ids_list(major_courses)

node_list = []

#creating nodes from major list and adding to node list
for course, course_id in zip(major_courses, major_courses_ids):
    major.node(str(course_id), course)
    if course_id not in node_list:
        node_list.append(course_id)

#for each course in major list, get prerequisites and add them to the graph

conn = sqlite3.connect('courses.db')
cur = conn.cursor()
for course_id in major_courses_ids:
    prereq_id_dict = {}

    find_prereq_query = '''
                        SELECT relationships.prerequisite,courses.subject,courses.number 
                        FROM relationships 
                        LEFT JOIN courses ON relationships.prerequisite = courses.id
                        WHERE requisite = ?
                        '''
    
    cur.execute(find_prereq_query, (course_id,))
    prereq_list = cur.fetchall()

    #add pairs to dict
    for prereq in prereq_list:
        if prereq is not None:
            prereq_id = prereq[0]
            prereq_subject = prereq[1]
            prereq_number = prereq[2]

            if prereq_subject is not None and prereq_number is not None:
                prereq_tag = " ".join([prereq_subject, str(prereq_number)])
                prereq_id_dict[prereq_id] = prereq_tag            

    #go through pairs, add to graph
    for prereq_id in prereq_id_dict.keys():
        prereq_tag = prereq_id_dict[prereq_id]
        if prereq_id not in node_list:
            major.node(str(prereq_id), prereq_tag)
        major.edge(str(prereq_id),str(course_id))


cur.close()
conn.close()


major.render('major_diagram', format='png', view=True)