import requests
from bs4 import BeautifulSoup
import csv
import os
import re

def clean_text(text):
    # Remove HTML tags and decode HTML entities
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&amp;', '&')
    text = text.replace('&nbsp;', ' ')
    return text.strip()

def extract_credits(text):
    # Extract credit hours from text like "Major Courses (22 Credit Hours)"
    match = re.search(r'\((\d+)\s*Credit\s*Hours?\)', text)
    if match:
        return int(match.group(1))
    return 0

def extract_course_codes(text):
    # Regular expression to match course codes (e.g., "ACCT 2121" or "ACCT 2121L")
    course_pattern = r'[A-Z]{4}\s+\d{4}L?'
    return re.findall(course_pattern, text)

def scrape_majors():
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)

    # Initialize CSV files
    with open('data/major_categories.csv', mode='w', newline='', encoding='utf-8') as categories_file:
        categories_writer = csv.writer(categories_file)
        categories_writer.writerow(['Major', 'Category ID', 'Category Name', 'Credit Hours'])

    with open('data/category_courses.csv', mode='w', newline='', encoding='utf-8') as courses_file:
        courses_writer = csv.writer(courses_file)
        courses_writer.writerow(['Category ID', 'Course'])

    # Get the list of majors
    majors_url = "https://academics.charlotte.edu/programs/undergraduate/bachelors"
    response = requests.get(majors_url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find all major links in the table
    major_links = soup.find_all('a', href=re.compile(r'catalog\.charlotte\.edu/preview_program\.php'))
    category_id = 1

    print(f"Found {len(major_links)} major links")

    for link in major_links:
        try:
            major_name = clean_text(link.text)
            major_url = link['href']
            
            print(f"Processing major: {major_name}")
            print(f"URL: {major_url}")

            # Visit the major's page
            major_response = requests.get(major_url)
            major_soup = BeautifulSoup(major_response.text, 'html.parser')
            
            # Find the program content area - it's in the content-wrapper div
            content_area = major_soup.find('div', {'id': 'content-wrapper'})
            if not content_area:
                print(f"Could not find content area for {major_name}")
                continue

            # Look for courseblock sections which contain requirements
            courseblocks = content_area.find_all('div', {'class': 'courseblock'})
            if not courseblocks:
                # If no courseblocks, look for any headers and content
                sections = content_area.find_all(['h2', 'h3', 'h4', 'p'])
            else:
                sections = courseblocks

            current_section = None
            for section in sections:
                section_text = clean_text(section.text)
                
                # Skip empty sections or navigation elements
                if not section_text or any(skip in section_text.lower() for skip in 
                                         ['back to top', 'print-friendly', 'facebook', 'tweet']):
                    continue
                
                # Check if this is a main section header
                if any(keyword in section_text.lower() for keyword in 
                      ['requirement', 'core', 'major', 'concentration', 'elective', 'degree', 'curriculum', 'foundation']):
                    credits = extract_credits(section_text)
                    current_section = section_text
                    
                    print(f"Found section: {section_text} ({credits} credits)")
                    
                    # Write to major_categories.csv
                    with open('data/major_categories.csv', mode='a', newline='', encoding='utf-8') as categories_file:
                        categories_writer = csv.writer(categories_file)
                        categories_writer.writerow([major_name, category_id, section_text, credits])
                    
                    # Look for courses in this section and following content
                    next_elem = section.find_next_sibling()
                    while next_elem and not (next_elem.name in ['h2', 'h3', 'h4'] and 
                          any(keyword in clean_text(next_elem.text).lower() for keyword in 
                              ['requirement', 'core', 'major', 'concentration', 'elective', 'degree', 'curriculum', 'foundation'])):
                        
                        # Check for course lists in courselistcomment or courselist classes
                        course_lists = next_elem.find_all('div', class_=lambda x: x and 
                                                        ('courselistcomment' in x or 'courselist' in x))
                        
                        if course_lists:
                            for course_list in course_lists:
                                courses = extract_course_codes(course_list.text)
                                if courses:
                                    print(f"Found courses in {current_section}: {courses}")
                                    with open('data/category_courses.csv', mode='a', newline='', encoding='utf-8') as courses_file:
                                        courses_writer = csv.writer(courses_file)
                                        for course in courses:
                                            courses_writer.writerow([category_id, course])
                        else:
                            # Check for courses in the element text
                            elem_text = clean_text(next_elem.text)
                            courses = extract_course_codes(elem_text)
                            if courses:
                                print(f"Found courses in {current_section}: {courses}")
                                with open('data/category_courses.csv', mode='a', newline='', encoding='utf-8') as courses_file:
                                    courses_writer = csv.writer(courses_file)
                                    for course in courses:
                                        courses_writer.writerow([category_id, course])
                        
                        next_elem = next_elem.find_next_sibling()
                    
                    category_id += 1

        except Exception as e:
            print(f"Error processing major {major_name}: {e}")

if __name__ == "__main__":
    scrape_majors() 