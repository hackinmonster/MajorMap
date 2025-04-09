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
    # Remove "Schedule of Classes" and clean up
    text = re.sub(r'\s*Schedule of Classes\s*', '', text)
    # Remove note text in parentheses
    text = re.sub(r'\([^)]*\)', '', text)
    return text.strip()

def extract_text_until_next_section(element):
    text_parts = []
    current = element.next_sibling
    
    while current and not (hasattr(current, 'name') and current.name in ['strong', 'hr']):
        if isinstance(current, str):
            text_parts.append(current.strip())
        else:
            text_parts.append(current.get_text().strip())
        current = current.next_sibling
    
    return clean_text(' '.join(filter(None, text_parts)))

def extract_course_codes(text):
    # Regular expression to match course codes (e.g., "ACCT 2121" or "ACCT 2121L")
    course_pattern = r'[A-Z]{4}\s+\d{4}L?'
    return re.findall(course_pattern, text)

def split_requirements(text):
    if not text:
        return []
    
    # Clean the text first
    text = clean_text(text)
    
    # Find all course codes
    courses = extract_course_codes(text)
    
    # If no courses found, return empty list
    if not courses:
        return []
        
    # For each course found, create a relationship entry
    relationships = []
    for course in courses:
        relationships.append(course)
    
    return relationships

def scrape_courses_to_csv():
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)

    # Initialize CSV files
    with open('data/courses.csv', mode='w', newline='', encoding='utf-8') as courses_file:
        courses_writer = csv.writer(courses_file)
        courses_writer.writerow(['Name', 'Subject', 'Number', 'Credits', 'Description', 'Restrictions'])

    with open('data/prerequisites.csv', mode='w', newline='', encoding='utf-8') as prereqs_file:
        prereqs_writer = csv.writer(prereqs_file)
        prereqs_writer.writerow(['Course ID', 'Required Course'])

    with open('data/corequisites.csv', mode='w', newline='', encoding='utf-8') as coreqs_file:
        coreqs_writer = csv.writer(coreqs_file)
        coreqs_writer.writerow(['Course ID', 'Required Course'])

    with open('data/pre_or_corequisites.csv', mode='w', newline='', encoding='utf-8') as pre_or_coreqs_file:
        pre_or_coreqs_writer = csv.writer(pre_or_coreqs_file)
        pre_or_coreqs_writer.writerow(['Course ID', 'Required Course'])

    # Process all 37 pages
    for page in range(1, 38):
        print(f"Processing page {page}...")
        url = f"https://catalog.charlotte.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D={page}&cur_cat_oid=38&expand=1&navoid=4596&print=1#acalog_template_course_filter"
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        course_data = soup.findAll('td', class_='width')

        for course in course_data:
            try:
                # Extract course details
                course_header = course.find('h3')
                if not course_header:
                    continue
                    
                course_text = course_header.get_text(strip=True)
                if ' - ' in course_text:
                    course_parts = course_text.split(' - ')
                    course_name = course_parts[1]
                    course_code = course_parts[0]
                else:
                    course_name = course_text
                    course_code = course_text
                
                # Split course code into subject and number
                code_parts = course_code.split()
                if len(code_parts) >= 2:
                    course_subject = code_parts[0]
                    course_number = code_parts[1]
                    course_id = f"{course_subject} {course_number}"
                else:
                    course_subject = course_code
                    course_number = ''
                    course_id = course_code

                # Extract description
                description_text = course.find('hr')
                description = extract_text_until_next_section(description_text) if description_text else None

                # Extract credits
                credits_text = course.find('strong', string="Credit Hours:")
                credits = extract_text_until_next_section(credits_text) if credits_text else None

                # Extract restrictions
                restrictions_text = course.find('strong', string="Restriction(s):")
                restrictions = extract_text_until_next_section(restrictions_text) if restrictions_text else None

                # Write course details
                with open('data/courses.csv', mode='a', newline='', encoding='utf-8') as courses_file:
                    courses_writer = csv.writer(courses_file)
                    courses_writer.writerow([course_name, course_subject, course_number, credits, description, restrictions])

                # Extract and write prerequisites
                prerequisites_text = course.find('strong', string="Prerequisite(s):")
                if prerequisites_text:
                    prerequisites = extract_text_until_next_section(prerequisites_text)
                    if prerequisites:
                        prereq_relationships = split_requirements(prerequisites)
                        with open('data/prerequisites.csv', mode='a', newline='', encoding='utf-8') as prereqs_file:
                            prereqs_writer = csv.writer(prereqs_file)
                            for req_course in prereq_relationships:
                                prereqs_writer.writerow([course_id, req_course])

                # Extract and write corequisites
                corequisites_text = course.find('strong', string="Corequisite(s):")
                if corequisites_text:
                    corequisites = extract_text_until_next_section(corequisites_text)
                    if corequisites:
                        coreq_relationships = split_requirements(corequisites)
                        with open('data/corequisites.csv', mode='a', newline='', encoding='utf-8') as coreqs_file:
                            coreqs_writer = csv.writer(coreqs_file)
                            for req_course in coreq_relationships:
                                coreqs_writer.writerow([course_id, req_course])

                # Extract and write pre-or corequisites
                pre_or_corequisites_text = course.find('strong', string="Pre- or Corequisite(s):")
                if pre_or_corequisites_text:
                    pre_or_corequisites = extract_text_until_next_section(pre_or_corequisites_text)
                    if pre_or_corequisites:
                        pre_or_coreq_relationships = split_requirements(pre_or_corequisites)
                        with open('data/pre_or_corequisites.csv', mode='a', newline='', encoding='utf-8') as pre_or_coreqs_file:
                            pre_or_coreqs_writer = csv.writer(pre_or_coreqs_file)
                            for req_course in pre_or_coreq_relationships:
                                pre_or_coreqs_writer.writerow([course_id, req_course])

            except Exception as e:
                print(f"Error processing course: {e}")

if __name__ == "__main__":
    scrape_courses_to_csv()

