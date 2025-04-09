import csv
import os

# Ensure data directory exists
os.makedirs('data', exist_ok=True)

# Define majors
majors = [
    {"major_id": 1, "major_name": "Computer Science, B.S."},
    {"major_id": 2, "major_name": "Computer Science, AI, Robotics, and Gaming Concentration, B.S."},
    {"major_id": 3, "major_name": "Criminal Justice, B.A."}
]

# Define major categories
major_categories = [
    # Computer Science, B.S.
    {"major_id": 1, "category_id": 1, "category_name": "Mathematics and Statistics", "credits": 6},
    {"major_id": 1, "category_id": 2, "category_name": "Core Courses", "credits": 29},
    {"major_id": 1, "category_id": 3, "category_name": "Capstone", "credits": 3},
    
    # Computer Science, AI, Robotics, and Gaming Concentration, B.S.
    {"major_id": 2, "category_id": 4, "category_name": "General Education Courses", "credits": 6},
    {"major_id": 2, "category_id": 5, "category_name": "Core Courses", "credits": 29},
    {"major_id": 2, "category_id": 6, "category_name": "Mathematics and Statistics", "credits": 6},
    {"major_id": 2, "category_id": 7, "category_name": "Capstone", "credits": 3},
    {"major_id": 2, "category_id": 8, "category_name": "Concentration Required Course", "credits": 9},
    {"major_id": 2, "category_id": 9, "category_name": "Concentration Electives", "credits": 6},
    {"major_id": 2, "category_id": 10, "category_name": "Concentration Technical Electives", "credits": 6},
    
    # Criminal Justice, B.A.
    {"major_id": 3, "category_id": 11, "category_name": "Foundation Courses", "credits": 10},
    {"major_id": 3, "category_id": 12, "category_name": "Statistics", "credits": 3},
    {"major_id": 3, "category_id": 13, "category_name": "Crime Analytics", "credits": 3},
    {"major_id": 3, "category_id": 14, "category_name": "Intercultural", "credits": 3},
    {"major_id": 3, "category_id": 15, "category_name": "Major Electives", "credits": 21}
]

category_courses = [
    # General Education Courses
    {'category_id': 4, 'course_id': 'MATH 1241'},
    {'category_id': 4, 'course_id': 'MATH 1242'},

    # Core Courses
    {'category_id': 5, 'course_id': 'ITSC 1212'},
    {'category_id': 5, 'course_id': 'ITSC 1213'},
    {'category_id': 5, 'course_id': 'ITSC 1600'},
    {'category_id': 5, 'course_id': 'ITSC 2600'},
    {'category_id': 5, 'course_id': 'ITSC 2175'},
    {'category_id': 5, 'course_id': 'MATH 2165'},
    {'category_id': 5, 'course_id': 'ITSC 2181'},
    {'category_id': 5, 'course_id': 'ITSC 2214'},
    {'category_id': 5, 'course_id': 'ITSC 3146'},
    {'category_id': 5, 'course_id': 'ITSC 3155'},
    {'category_id': 5, 'course_id': 'ITSC 3688'},

    # Mathematics and Statistics
    {'category_id': 6, 'course_id': 'MATH 2164'},
    {'category_id': 6, 'course_id': 'STAT 2122'},

    # Capstone
    {'category_id': 7, 'course_id': 'ITCS 4232'},
    {'category_id': 7, 'course_id': 'ITCS 4238'},
    {'category_id': 7, 'course_id': 'ITIS 4390'},
    {'category_id': 7, 'course_id': 'ITIS 4246'},
    {'category_id': 7, 'course_id': 'ITSC 4155'},
    {'category_id': 7, 'course_id': 'ITSC 4681'},
    {'category_id': 7, 'course_id': 'ITSC 4682'},
    {'category_id': 7, 'course_id': 'ITSC 4750'},
    {'category_id': 7, 'course_id': 'ITSC 4850'},
    {'category_id': 7, 'course_id': 'ITSC 4851'},
    {'category_id': 7, 'course_id': 'ITSC 4990'},
    {'category_id': 7, 'course_id': 'ITSC 4991'},

    # Concentration Required Course
    {'category_id': 8, 'course_id': 'ITCS 3153'},
    {'category_id': 8, 'course_id': 'ITCS 3156'},

    # Concentration Electives
    {'category_id': 9, 'course_id': 'ITCS 3120'},
    {'category_id': 9, 'course_id': 'ITCS 3153'},
    {'category_id': 9, 'course_id': 'ITCS 3156'},
    {'category_id': 9, 'course_id': 'ITCS 4101'},
    {'category_id': 9, 'course_id': 'ITCS 4114'},
    {'category_id': 9, 'course_id': 'ITCS 4123'},
    {'category_id': 9, 'course_id': 'ITCS 4124'},
    {'category_id': 9, 'course_id': 'ITCS 4150'},
    {'category_id': 9, 'course_id': 'ITCS 4151'},
    {'category_id': 9, 'course_id': 'ITCS 4152'},
    {'category_id': 9, 'course_id': 'ITCS 4230'},
    {'category_id': 9, 'course_id': 'ITCS 4231'},
    {'category_id': 9, 'course_id': 'ITCS 4236'}
]

# Write majors to CSV
with open('data/majors.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['major_id', 'major_name'])
    writer.writeheader()
    writer.writerows(majors)

# Write major categories to CSV
with open('data/major_categories.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['major_id', 'category_id', 'category_name', 'credits'])
    writer.writeheader()
    writer.writerows(major_categories)

# Write category courses to CSV
with open('data/category_courses.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['category_id', 'course_id'])
    writer.writeheader()
    writer.writerows(category_courses)

print("Sample data generated successfully!") 