This is a small project of mine aimed at helping students visualize their plan of study. Currently, the best alternative for course planning is to use DegreeWorks, which lists required courses by category (major, electives, etc), but this lacks visualization features, making it difficult to mentally map out a plan. 

I designed this project as a solution to that very problem. Using this tool, students can pick their program and the courses they've taken, and automatically generate a tree-like visualization, mapping out which courses they can take, and when. Each arrow points from a prerequisite to a requisite, with earlier classes being toward the left, and later toward the right.

What's currently implemented?
- Web-scraper to load courses from course catalog, and their relationships
- Schema for storing courses, majors, and entity relationships
- Basic front-end to visualize courses

What needs to be implemented?
- Web-scraper to load majors with their requirement categories (Core, elective, etc). Will definitely be using a language model to help because of how inconsistent the formatting of requirements is.
- Logic to handle different types of requirements and parse natural language (Pick 2 from following, 6 credits from any ITSC XXXX, etc)
- Improved front-end
- Adding multiple majors and minors

Future:
- Chatbot that uses RAG with all the course descriptions to help students find courses that match their interests and goals
- Functionality for helping students understand WHEN courses are offered. Many courses exist in catalog but are almost never actually offered. This makes planning difficult.
- Basic search engine for finding courses with name with improved filtering
- Student course rating



B.S. Computer Science (Only core courses showing)
![Screenshot from 2025-04-09 13-57-48](https://github.com/user-attachments/assets/2a0b9f4a-d09f-4a02-bfbb-77495bba8c05)

