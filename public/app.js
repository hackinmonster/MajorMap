// Global variables
let majors = [];
let majorCategories = [];
let categoryCourses = [];
let courses = [];
let prerequisites = [];
let selectedMajor = null;
let simulation = null;
let svg = null;
let selectedCourses = new Set(); // Track selected courses
let categoryCredits = new Map(); // Track remaining credits per category
let semesterCourses = new Map(); // Track courses assigned to semesters
let timelineCourses = new Set(); // Track courses that have been moved to timeline but should stay selected
let spotlightMode = false; // Track if we're in semester spotlight mode
let currentSpotlightSemester = null; // Track which semester is spotlighted

// Credit overrides for courses with incorrect values in CSV
const creditOverrides = {
    'ITSC 1212': 4,
    'ITSC 1213': 4,
    'ITSC 2214': 4,
    'ITSC 2181': 4,
    'ITSC 1600': 2,
    'ITSC 2600': 2
};

// Helper function to get correct credit value for a course
function getCourseCredits(courseId, defaultCredits) {
    if (creditOverrides.hasOwnProperty(courseId)) {
        return creditOverrides[courseId];
    }
    return defaultCredits || 3;
}

// Load data from CSV files
async function loadData() {
    try {
        console.log('Starting to load data...');
        
        // Load each file individually to better track errors
        console.log('Loading majors.csv...');
        const majorsData = await d3.csv('data/majors.csv');
        console.log('Majors loaded:', majorsData);

        console.log('Loading major_categories.csv...');
        const categoriesData = await d3.csv('data/major_categories.csv', d => {
            const credits = parseInt(d.credits) || 0;
            console.log('Category credits:', d.category_name, credits);
            return {
                major_id: d.major_id,
                category_id: d.category_id,
                category_name: d.category_name,
                credits_required: credits
            };
        });
        console.log('Categories loaded:', categoriesData);

        console.log('Loading category_courses.csv...');
        const coursesData = await d3.csv('data/category_courses.csv');
        console.log('Course links loaded:', coursesData);

        console.log('Loading prerequisites.csv...');
        const prerequisitesData = await d3.csv('data/prerequisites.csv', d => ({
            course_id: d['Course ID'],
            prerequisite_id: d['Required Course']
        }));
        console.log('Prerequisites loaded:', prerequisitesData);

        console.log('Loading courses.csv...');
        const allCoursesData = await d3.csv('data/courses.csv', d => {
            const course_id = `${d.Subject} ${d.Number}`;
            // Log raw data to see what we're getting
            console.log('Raw course data:', d);
            console.log('Raw credits value:', d.Credits);
            
            // Try to parse credits, checking different possible column names
            let credits = null;
            if (d.Credits !== undefined) credits = parseInt(d.Credits);
            if (credits === null && d.credits !== undefined) credits = parseInt(d.credits);
            if (credits === null && d.Credit !== undefined) credits = parseInt(d.Credit);
            if (credits === null && d.credit !== undefined) credits = parseInt(d.credit);
            
            // Use credit override system for correct values
            const finalCredits = getCourseCredits(course_id, credits);
            
            console.log('Parsed credits:', credits, 'Final credits:', finalCredits);
            
            return {
                course_id: course_id,
                Name: d.Name,
                Subject: d.Subject,
                Number: d.Number,
                Credits: finalCredits,
                Description: d.Description || d.description || '' // Include description field
            };
        });
        console.log('Sample of loaded courses:', allCoursesData.slice(0, 5));

        majors = majorsData;
        majorCategories = categoriesData;
        categoryCourses = coursesData;
        courses = allCoursesData;
        prerequisites = prerequisitesData;

        console.log('Data loading complete');
        
        // Initialize search functionality
        initializeSearch();
        
        // Initialize drag-and-drop for course assignment
        initializeCourseAssignment();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('majorSearch');
    const searchResults = document.getElementById('searchResults');
    const searchButton = document.getElementById('searchButton');

    function performSearch() {
        console.log('Current majors:', majors);
        const searchTerm = searchInput.value.toLowerCase();
        console.log('Search term:', searchTerm);
        
        const results = majors.filter(major => 
            major.major_name.toLowerCase().includes(searchTerm)
        );
        console.log('Search results:', results);

        searchResults.innerHTML = '';
        
        if (results.length > 0) {
            results.forEach(major => {
                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.innerHTML = `<i class="fas fa-graduation-cap me-2"></i>${major.major_name}`;
                item.onclick = () => selectMajor(major);
                searchResults.appendChild(item);
            });
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    }

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    // Show search results when input is focused and has content
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
            performSearch();
        }
    });

    searchInput.addEventListener('input', performSearch);
    searchButton.addEventListener('click', performSearch);
}

// Handle major selection
function selectMajor(major) {
    selectedMajor = major;
    selectedCourses.clear(); // Clear selected courses when changing majors
    categoryCredits.clear(); // Clear category credits
    semesterCourses.clear(); // Clear semester assignments
    timelineCourses.clear(); // Clear timeline course tracking
    
    // Clear spotlight mode
    spotlightMode = false;
    currentSpotlightSemester = null;
    
    document.getElementById('majorSearch').value = major.major_name;
    document.getElementById('searchResults').style.display = 'none';
    
    // Clear all semester boxes
    const semesterContents = document.querySelectorAll('.semester-content');
    semesterContents.forEach(content => {
        content.innerHTML = '';
    });
    
    // Reset semester credit counters
    const creditCounters = document.querySelectorAll('.timeline-credits');
    creditCounters.forEach(counter => {
        counter.textContent = '0 credits';
    });
    
    // Make sure timeline container is visible
    document.getElementById('timeline-container').style.display = 'block';
    
    // Initialize the sidebar and visualization
    initializeSidebar(major.major_id);
    visualizeMajor(major.major_id);
}

// Initialize the sidebar with categories and courses
function initializeSidebar(majorId) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '<h3>Course Categories</h3>';

    // Get categories for this major
    const categories = majorCategories.filter(cat => cat.major_id === majorId);
    
    categories.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        
        // Create category header (clickable)
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.onclick = () => toggleCategoryDropdown(category.category_id);
        
        // Category title
        const categoryTitle = document.createElement('div');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.category_name;
        
        // Category status (completion indicator + dropdown arrow)
        const categoryStatus = document.createElement('div');
        categoryStatus.className = 'category-status';
        
        // Completion indicator
        const completionIndicator = document.createElement('span');
        completionIndicator.className = 'completion-indicator';
        completionIndicator.id = `completion-${category.category_id}`;
        
        // Credits info
        const creditsInfo = document.createElement('span');
        creditsInfo.className = 'credits-info';
        creditsInfo.id = `credits-${category.category_id}`;
        
        // Dropdown arrow
        const dropdownArrow = document.createElement('span');
        dropdownArrow.className = 'dropdown-arrow expanded'; // Start expanded
        dropdownArrow.innerHTML = '▼';
        dropdownArrow.id = `arrow-${category.category_id}`;
        
        categoryStatus.appendChild(completionIndicator);
        categoryStatus.appendChild(creditsInfo);
        categoryStatus.appendChild(dropdownArrow);
        
        categoryHeader.appendChild(categoryTitle);
        categoryHeader.appendChild(categoryStatus);
        
        // Create category content (initially visible)
        const categoryContent = document.createElement('div');
        categoryContent.className = 'category-content expanded'; // Start expanded
        categoryContent.id = `content-${category.category_id}`;
        
        // Category info
        const categoryInfo = document.createElement('div');
        categoryInfo.className = 'category-info';
        categoryInfo.innerHTML = `
            <strong>Required Credits:</strong> ${category.credits_required}<br>
            <strong>Description:</strong> ${category.description || 'No description available'}
        `;
        categoryContent.appendChild(categoryInfo);
        
        // Get courses for this category
        const categoryCoursesData = categoryCourses.filter(cc => cc.category_id === category.category_id);
        const categoryCoursesIds = categoryCoursesData.map(cc => cc.course_id);
        const coursesInCategory = courses.filter(course => categoryCoursesIds.includes(course.course_id));
        
        coursesInCategory.forEach(course => {
            const courseItem = document.createElement('div');
                courseItem.className = 'course-item';
                
            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'course-checkbox';
            checkbox.id = `checkbox-${course.course_id}`;
            checkbox.checked = selectedCourses.has(course.course_id);
            checkbox.onchange = () => toggleCourseFromCheckbox(course, category);
            
            // Course label
            const courseLabel = document.createElement('label');
            courseLabel.className = 'course-label';
            courseLabel.htmlFor = `checkbox-${course.course_id}`;
            courseLabel.innerHTML = `<strong>${course.course_id}</strong><br>${course.Name}`;
            
            // Course credits
            const courseCredits = document.createElement('span');
            courseCredits.className = 'course-credits';
            courseCredits.textContent = `${course.Credits} cr`;
            
            courseItem.appendChild(checkbox);
            courseItem.appendChild(courseLabel);
            courseItem.appendChild(courseCredits);
            
            categoryContent.appendChild(courseItem);
        });
        
        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(categoryContent);
        sidebar.appendChild(categorySection);
        
        // Initialize category credits tracking
        updateCategoryCredits(category);
        
        // Update category status
        updateCategoryStatus(category);
    });
}

// Toggle category dropdown
function toggleCategoryDropdown(categoryId) {
    const content = document.getElementById(`content-${categoryId}`);
    const arrow = document.getElementById(`arrow-${categoryId}`);
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        arrow.classList.remove('expanded');
    } else {
        content.classList.add('expanded');
        arrow.classList.add('expanded');
    }
}

// Toggle course selection from checkbox
function toggleCourseFromCheckbox(course, category) {
    const checkbox = document.getElementById(`checkbox-${course.course_id}`);
    
    if (checkbox.checked) {
        if (!selectedCourses.has(course.course_id)) {
            selectedCourses.add(course.course_id);
            
            // Only add to visualization if not in timeline and visualization exists
            if (!timelineCourses.has(course.course_id)) {
                addCourseToVisualizationSmoothly(course.course_id);
            }
        }
    } else {
        selectedCourses.delete(course.course_id);
        // Remove from timeline if it was there
        timelineCourses.delete(course.course_id);
        removeCourseFromAllSemesters(course.course_id);
        
        // Remove the node from visualization if it exists
        const existingNode = d3.selectAll('.node').filter(d => d.id === course.course_id);
        if (!existingNode.empty()) {
            existingNode.transition()
                .duration(300)
                .style('opacity', 0)
                .on('end', function() {
                    d3.select(this).remove();
                });
            
            // Remove connected links
            const connectedLinks = d3.selectAll('path[marker-end]').filter(l => 
                l.source.id === course.course_id || l.target.id === course.course_id
            );
            connectedLinks.transition()
                .duration(300)
                .style('opacity', 0)
                .on('end', function() {
                    d3.select(this).remove();
                });
        }
    }
    
    // Update category credits and status
    updateCategoryCredits(category);
    updateCategoryStatus(category);
}

// Update category status (completion indicator and styling)
function updateCategoryStatus(category) {
    const completionIndicator = document.getElementById(`completion-${category.category_id}`);
    const creditsInfo = document.getElementById(`credits-${category.category_id}`);
    const content = document.getElementById(`content-${category.category_id}`);
    
    if (!completionIndicator || !creditsInfo || !content) {
        console.log('Missing elements for category:', category.category_id);
        return;
    }
    
    const header = content.previousElementSibling;
    
    // Calculate current credits
    const currentCredits = categoryCredits.get(category.category_id) || 0;
    const requiredCredits = parseInt(category.credits_required) || 0;
    
    // Update credits display
    creditsInfo.textContent = `${currentCredits}/${requiredCredits}`;
    
    // Update completion indicator and styling
    if (currentCredits >= requiredCredits && requiredCredits > 0) {
        // Category is complete
        completionIndicator.textContent = '✓';
        completionIndicator.className = 'completion-indicator complete';
        header.className = 'category-header completed';
    } else {
        // Category is incomplete
        completionIndicator.textContent = '✗';
        completionIndicator.className = 'completion-indicator incomplete';
        header.className = 'category-header incomplete';
    }
}

// Initialize drag-and-drop for course assignment to semesters
function initializeCourseAssignment() {
    // Make semester content areas drop targets
    const semesterContents = document.querySelectorAll('.semester-content');
    
    semesterContents.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.classList.add('drag-over');
        });
        
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            // Get course data from the drag event
            const courseId = e.dataTransfer.getData('text/plain');
            let courseData;
            
            try {
                courseData = JSON.parse(e.dataTransfer.getData('application/json'));
            } catch (err) {
                console.error('Error parsing course data:', err);
                return;
            }
            
            // Get semester ID from the parent element
            const semesterId = container.parentElement.id;
            
            // Validate prerequisite constraints before adding
            if (validateCourseScheduling(courseData.id, semesterId)) {
                // Add course to semester
                addCourseToSemester(courseData, semesterId);
            }
        });
    });
    
    // Add click handlers to semester headers for spotlight functionality
    const semesterHeaders = document.querySelectorAll('.semester-header');
    semesterHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            const semesterId = header.parentElement.id;
            toggleSemesterSpotlight(semesterId);
        });
        
        // Add visual indication that headers are clickable
        header.style.cursor = 'pointer';
        header.title = 'Click to highlight available courses for this semester';
    });
}

// Add a course to a semester box
function addCourseToSemester(courseData, semesterId) {
    // Check if course is already in a semester
    removeCourseFromAllSemesters(courseData.id);
    
    // Get the semester content area
    const semesterContent = document.querySelector(`#${semesterId} .semester-content`);
    if (!semesterContent) return;
    
    // Create course element with flexbox layout
    const courseElement = document.createElement('div');
    courseElement.className = 'timeline-course';
    courseElement.dataset.courseId = courseData.id;
    
    // Course info (left side)
    const courseInfo = document.createElement('span');
    courseInfo.className = 'course-info';
    courseInfo.textContent = `${courseData.id} (${courseData.credits} cr)`;
    
    // Remove button (right side)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-outline-danger course-remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove course';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeCourseFromSemester(courseData.id, semesterId);
        timelineCourses.delete(courseData.id);
        
        // Instead of rebuilding, add the course back to the visualization if it's selected
        if (selectedCourses.has(courseData.id) && selectedMajor) {
            addCourseBackToVisualization(courseData.id);
        }
    };
    
    courseElement.appendChild(courseInfo);
    courseElement.appendChild(removeBtn);
    
    // Add course to the semester
    semesterContent.appendChild(courseElement);
    
    // Update semester course tracking
    if (!semesterCourses.has(semesterId)) {
        semesterCourses.set(semesterId, new Map());
    }
    semesterCourses.get(semesterId).set(courseData.id, courseData);
    
    // Update semester credits
    updateSemesterCredits(semesterId);
    
    // Mark this course as in timeline
    timelineCourses.add(courseData.id);
    
    // Make sure the course bubble is selected
    const courseBubble = document.querySelector(`.course-bubble[data-course-id="${courseData.id}"]`);
    if (courseBubble && !selectedCourses.has(courseData.id)) {
        // Find the course and category objects
        const course = courses.find(c => c.course_id === courseData.id);
        const categoryId = courseBubble.dataset.categoryId;
        const category = majorCategories.find(cat => cat.category_id === categoryId);
        
        if (course && category) {
            // Toggle the course selection
            toggleCourse(courseBubble, course, category);
        }
    }
    
    // Update visualization only when dragged from sidebar (not from graph)
    // Graph-to-timeline drag is handled by updateVisualizationWithoutCourse
}

// Remove a course from a specific semester
function removeCourseFromSemester(courseId, semesterId) {
    // Remove the course element from the semester
    const courseElement = document.querySelector(`#${semesterId} .timeline-course[data-course-id="${courseId}"]`);
    if (courseElement) {
        courseElement.remove();
    }
    
    // Update semester course tracking
    if (semesterCourses.has(semesterId)) {
        semesterCourses.get(semesterId).delete(courseId);
    }
    
    // Update semester credits
    updateSemesterCredits(semesterId);
    
    // Remove from timeline tracking so it appears in visualization again
    timelineCourses.delete(courseId);
}

// Remove a course from all semesters
function removeCourseFromAllSemesters(courseId) {
    // Check all semester boxes for this course
    const courseElements = document.querySelectorAll(`.timeline-course[data-course-id="${courseId}"]`);
    
    courseElements.forEach(element => {
        const semesterId = element.closest('.semester-box').id;
        removeCourseFromSemester(courseId, semesterId);
    });
    
    // Ensure it's removed from timeline tracking
    timelineCourses.delete(courseId);
}

// Update the credit counter for a semester
function updateSemesterCredits(semesterId) {
    const creditsElement = document.querySelector(`#${semesterId} .timeline-credits`);
    if (!creditsElement) return;
    
    let totalCredits = 0;
    
    if (semesterCourses.has(semesterId)) {
        const courses = semesterCourses.get(semesterId);
        courses.forEach(course => {
            totalCredits += course.credits || 0; // Use the credits from the stored course data
        });
    }
    
    creditsElement.textContent = `${totalCredits} credits`;
}

// Get color based on subject
function getSubjectColor(subject) {
    // Create a consistent color for each subject
    const colors = {
        'ITSC': '#FF6B6B',  // Computer Science - Coral Red
        'MATH': '#4ECDC4',  // Mathematics - Turquoise
        'STAT': '#45B7D1',  // Statistics - Sky Blue
        'ITIS': '#96CEB4',  // Information Technology - Sage Green
        'ITCS': '#FFEEAD',  // Computer Science - Light Yellow
        'ENGL': '#D4A5A5',  // English - Dusty Rose
        'HIST': '#9B59B6',  // History - Purple
        'CHEM': '#3498DB',  // Chemistry - Blue
        'PHYS': '#2ECC71',  // Physics - Green
        'BIOL': '#E67E22',  // Biology - Orange
        'PSYC': '#F1C40F',  // Psychology - Yellow
        'SOCI': '#E74C3C',  // Sociology - Red
        'ACCT': '#1ABC9C',  // Accounting - Teal
        'CHNS': '#E91E63',  // Chinese - Pink
        'ETFS': '#8E44AD',  // Fire Safety - Purple
        'HAHS': '#16A085',  // Health - Dark Teal
        'ITLN': '#F39C12',  // Italian - Orange
        'LBST': '#7F8C8D',  // Liberal Studies - Gray
        'ECON': '#F1C40F',  // Economics - Yellow
        'BUSN': '#2C3E50',  // Business - Dark Blue
        'MGMT': '#34495E',  // Management - Blue Gray
        'MKTG': '#E74C3C',  // Marketing - Red
        'FINC': '#27AE60',  // Finance - Green
        'OPRS': '#8E44AD',  // Operations - Purple
        'default': '#95A5A6' // Default color - Gray
    };
    
    const color = colors[subject] || colors.default;
    console.log('Getting color for subject:', subject, 'Color:', color);
    return color;
}

// Create visualization for selected major
function visualizeMajor(majorId) {
    // Store current zoom transform if it exists
    let currentTransform = d3.zoomIdentity;
    const existingSvg = d3.select('#visualization svg');
    if (!existingSvg.empty()) {
        try {
            currentTransform = d3.zoomTransform(existingSvg.node());
        } catch (e) {
            // If no transform exists, use identity
            currentTransform = d3.zoomIdentity;
        }
    }
    
    // Clear previous visualization
    d3.select('#visualization').selectAll('*').remove();

    // Get all courses for the selected major
    const categories = majorCategories.filter(cat => cat.major_id === majorId);
    const categoryIds = categories.map(cat => parseInt(cat.category_id));
    const courseLinks = categoryCourses.filter(cc => categoryIds.includes(parseInt(cc.category_id)));
    const courseIds = courseLinks.map(cc => cc.course_id);
    
    // First, get the direct major courses
    let majorCourses = courses.filter(course => courseIds.includes(course.course_id));
    
    // Get all prerequisites for these courses
    const allPrereqs = prerequisites.filter(p => courseIds.includes(p.course_id));
    const prereqIds = allPrereqs.map(p => p.prerequisite_id);
    
    // Add all prerequisite courses that aren't already included
    const prereqCourses = courses.filter(course => 
        prereqIds.includes(course.course_id) && !courseIds.includes(course.course_id)
    );
    
    // Combine all courses
    majorCourses = [...majorCourses, ...prereqCourses];
    
    // Filter courses based on selection and not in timeline
    majorCourses = majorCourses.filter(course => 
        selectedCourses.has(course.course_id) && !timelineCourses.has(course.course_id)
    );
    
    // Get the final list of all course IDs (both major courses and prerequisites)
    const allCourseIds = majorCourses.map(course => course.course_id);
    
    console.log('Major courses with prerequisites:', majorCourses);
    console.log('All course IDs:', allCourseIds);
    
    // Set up the visualization
    const container = document.getElementById('visualization');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 10, right: 10, bottom: 30, left: 10 };

    // Create SVG with defs for arrow marker
    const svg = d3.select('#visualization')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block'); // Ensure SVG takes full space

    // Define arrow marker with improved visibility
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 40) // Position relative to node
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 12) // Smaller arrows
        .attr('markerHeight', 12)
        .attr('xoverflow', 'visible')
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
        .attr('fill', '#666') // Darker color for better visibility
        .style('stroke', 'none');

    // Add zoom behavior with wider range
    const zoom = d3.zoom()
        .scaleExtent([0.05, 5])  // Allow zooming out much further
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Create container group
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate prerequisite levels for each course
    function calculatePrereqLevels(courseIds) {
        const levels = new Map();
        
        // Initialize all courses to level 0
        courseIds.forEach(id => levels.set(id, 0));
        
        // Repeatedly update levels until no changes are made
        let changed = true;
        while (changed) {
            changed = false;
            prerequisites.forEach(prereq => {
                if (courseIds.includes(prereq.course_id) && courseIds.includes(prereq.prerequisite_id)) {
                    const currentLevel = levels.get(prereq.course_id);
                    const prereqLevel = levels.get(prereq.prerequisite_id);
                    const newLevel = prereqLevel + 1;
                    if (currentLevel < newLevel) {
                        levels.set(prereq.course_id, newLevel);
                        changed = true;
                    }
                }
            });
        }
        
        return levels;
    }

    // Calculate levels for all courses
    const prereqLevels = calculatePrereqLevels(allCourseIds);
    console.log('Prerequisite levels:', prereqLevels);

    // Create nodes including root node and add level information
    const nodes = [
        // Add root node
        {
            id: 'root',
            name: '',
            type: 'root',
            size: 30,
            courseNumber: 0,
            level: -1, // Root is before level 0
        },
        // Add course nodes
        ...majorCourses.map(course => {
            // Parse the full course number properly
            let courseNumber = 0;
            if (course.Number) {
                // Extract just the numeric part from the course number
                const numMatch = course.Number.match(/(\d+)/);
                if (numMatch && numMatch[1]) {
                    courseNumber = parseInt(numMatch[1], 10);
                }
            }
            
            return {
            id: course.course_id,
            name: course.Name,
            type: 'course',
            subject: course.Subject,
                size: 60,
                courseNumber: courseNumber,
                level: prereqLevels.get(course.course_id) || 0,
                credits: course.Credits // Use the Credits from the course object which includes overrides
            };
        })
    ];

    // Create links only for courses that exist in our nodes
    const links = [
        // Add prerequisite links (only if both source and target exist)
        ...prerequisites
            .filter(p => 
                allCourseIds.includes(p.course_id) && 
                allCourseIds.includes(p.prerequisite_id)
            )
            .map(p => ({
                source: p.prerequisite_id,
                target: p.course_id
            })),
        // Add root links for courses without prerequisites
        ...majorCourses
            .filter(course => !prerequisites.some(p => p.course_id === course.course_id))
            .map(course => ({
                source: 'root',
                target: course.course_id
            }))
    ];

    // Calculate the range of course numbers and levels for scaling
    const minCourseNumber = Math.min(...nodes.map(d => d.courseNumber));
    const maxCourseNumber = Math.max(...nodes.map(d => d.courseNumber));
    const maxLevel = Math.max(...nodes.map(d => d.level));
    
    // Create enhanced x-scale for horizontal positioning based on course number
    // Map course numbers to positions across the full range
    const xScale = d3.scaleLinear()
        .domain([0, 4999])  // Course numbers typically range from 1000-4999
        .range([margin.left + 50, width - margin.right - 50]);
    
    // Create the force simulation with better horizontal and vertical spread
    const simulation = d3.forceSimulation(nodes)
        // Link force with increased distance for better readability
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(d => {
                // Make links to/from root shorter
                if (d.source.id === 'root' || d.target.id === 'root') {
                    return 150;
                }
                // Longer distance for prerequisite links to make them more visible
                return 300;
            })
            .strength(0.6)) // Stronger link force for course relationships
        
        // Stronger repulsion between nodes to prevent clumping
        .force('charge', d3.forceManyBody()
            .strength(d => d.type === 'root' ? -500 : -4500) // Stronger for course nodes
            .distanceMax(500)) // Limit the maximum distance of effect
        
        // Centering force to keep nodes generally centered
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        
        // X-force based on full course number and prerequisite relationships
        .force('x', d3.forceX(d => {
        if (d.type === 'root') {
                return margin.left + 80; // Root node on far left
            }
            
            // Map course number to x position with prerequisite adjustments
            // Higher level courses (with prerequisites) move further right
            const basePosition = xScale(d.courseNumber);
            
            // Courses with prerequisites shift right
            const prereqShift = d.level * 120;
            
            return basePosition + prereqShift;
        }).strength(0.7)) // Stronger x-force for clearer ordering
        
        // Y-force to spread out nodes vertically
        .force('y', d3.forceY(d => {
            if (d.type === 'root') {
                return height / 2; // Root in the middle
            }
            
            // Create vertical spread based on course subject and number
            const subjectHash = d.subject ? d.subject.charCodeAt(0) % 3 : 0;
            const numberHash = (d.courseNumber % 100) / 100;
            
            // Calculate vertical position with multiple factors
            // Level provides primary vertical grouping
            const levelOffset = d.level * 70;
            // Add some randomness based on subject and number for better spacing
            const spreadFactor = (subjectHash - 1) * 60 + (numberHash - 0.5) * 120;
            
            return (height / 2) + levelOffset + spreadFactor;
        }).strength(0.1)) // Moderate vertical force
        
        // Prevent node overlap with larger collision radius
        .force('collision', d3.forceCollide().radius(d => d.size + 30).strength(0.8));

    // Add links with arrows
    const link = g.append('g')
        .selectAll('path')
        .data(links)
        .enter()
        .append('path')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrowhead)');

    // Add nodes
    const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(drag(simulation));

    // Add circles to nodes
    node.append('circle')
        .attr('r', d => d.size)
        .attr('fill', d => {
            if (d.type === 'root') return '#ccc';
            const color = getSubjectColor(d.subject);
            console.log('Setting color for node:', d.subject, 'Color:', color);
            return color;
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 5px rgba(0,0,0,0.3))');

    // Add text to nodes (below the circle)
    node.append('text')
        .attr('dy', 5)
        .attr('text-anchor', 'middle')
        .text(d => {
            if (d.type === 'root') return '';
            return d.id;
        })
        .style('fill', '#fff')
        .style('font-size', '16px')
        .style('pointer-events', 'none')
        .style('font-weight', 'bold');

    // Function to calculate link path
    function linkArc(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate the angle between source and target
        const angle = Math.atan2(dy, dx);
        
        // Find other links between the same nodes
        const parallelLinks = links.filter(l => 
            (l.source.id === d.source.id && l.target.id === d.target.id) ||
            (l.source.id === d.target.id && l.target.id === d.source.id)
        );
        
        // If there are parallel links, curve them differently
        if (parallelLinks.length > 1) {
            const index = parallelLinks.indexOf(d);
            const curve = 20 * (index - (parallelLinks.length - 1) / 2);
            
            // Calculate control point
            const midX = (d.source.x + d.target.x) / 2;
            const midY = (d.source.y + d.target.y) / 2;
            const offsetX = -Math.sin(angle) * curve;
            const offsetY = Math.cos(angle) * curve;
            
            return `M${d.source.x},${d.source.y} 
                    Q${midX + offsetX},${midY + offsetY} 
                    ${d.target.x},${d.target.y}`;
        }
        
        // For single links, add a slight curve
        return `M${d.source.x},${d.source.y} 
                Q${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2 + 10} 
                ${d.target.x},${d.target.y}`;
    }

    // Update simulation tick function without bounds checking
    simulation.on('tick', () => {
        // Update node positions with NO bounds checking
        node.attr('transform', d => `translate(${d.x},${d.y})`);

        // Update link paths
        link.attr('d', linkArc);
    });

    // Add hover effect for links
    link.on('mouseover', function() {
        d3.select(this)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 1);
    })
    .on('mouseout', function() {
        d3.select(this)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
    });

    // Create tooltip for node hover to show more details and highlight connections
    const tooltip = d3.select('#tooltip');
    
    node.on('mouseover', function(event, d) {
        if (d.type === 'course') {
            // Show tooltip
            tooltip.style('opacity', 1);
            tooltip.html(`
                <strong>${d.id}</strong><br>
                ${d.name}
            `);
            
            // Position the tooltip near the node
            tooltip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 28) + 'px');
            
            // Only highlight connections if spotlight mode is NOT active
            if (!spotlightMode) {
                highlightConnections(d.id);
            }
        }
    })
    .on('mouseout', function(event, d) {
        // Hide tooltip
        tooltip.style('opacity', 0);
        
        // Only remove connection highlighting if spotlight mode is NOT active
        if (d.type === 'course' && !spotlightMode) {
            removeHighlighting();
        }
    })
    .on('click', function(event, d) {
        // Single click: add to spotlight semester if in spotlight mode
        if (spotlightMode && currentSpotlightSemester && d.type === 'course') {
            event.stopPropagation();
            addCourseToSpotlightSemester(d.id);
        }
    })
    .on('dblclick', function(event, d) {
        // Double click: show course information
        if (d.type === 'course') {
            event.stopPropagation();
            showCourseInformation(d.id);
        }
    });

    // Function to highlight connections for a specific course
    function highlightConnections(courseId) {
        // Don't highlight connections if spotlight mode is active
        if (spotlightMode) {
            return;
        }
        
        // Find all connected course IDs
        const connectedIds = new Set([courseId]); // Include the hovered course itself
        
        // Add courses that this course is a prerequisite for
        links.forEach(link => {
            if (link.source.id === courseId) {
                connectedIds.add(link.target.id);
            }
            if (link.target.id === courseId) {
                connectedIds.add(link.source.id);
            }
        });
        
        // Fade non-connected nodes
        node.style('opacity', d => {
            if (d.type === 'root') return 1; // Keep root visible
            return connectedIds.has(d.id) ? 1 : 0.2;
        });
        
        // Fade non-connected links
        link.style('opacity', l => {
            return (connectedIds.has(l.source.id) && connectedIds.has(l.target.id)) ? 0.8 : 0.1;
        });
        
        // Highlight connected links more strongly
        link.style('stroke-width', l => {
            return (l.source.id === courseId || l.target.id === courseId) ? 4 : 2;
        });
    }
    
    // Function to remove highlighting
    function removeHighlighting() {
        // Only remove connection highlighting if spotlight mode is not active
        if (!spotlightMode) {
            node.style('opacity', 1);
            link.style('opacity', 0.6);
            link.style('stroke-width', 2);
        }
    }

    // Create legend with more efficient layout
    const uniqueSubjects = [...new Set(majorCourses.map(d => d.Subject))];
    
    // Update legend position to be at the bottom
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${margin.left},${height - margin.bottom + 10})`);

    // Make legend more compact
    const legendItemWidth = 80;
    const legendItemsPerRow = Math.floor((width - margin.left - margin.right) / legendItemWidth);

    const legendItem = legend.selectAll('.legend-item')
        .data(uniqueSubjects)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => {
            const row = Math.floor(i / legendItemsPerRow);
            const col = i % legendItemsPerRow;
            return `translate(${col * legendItemWidth}, ${row * 15})`;
        });

    legendItem.append('circle')
        .attr('r', 5)
        .attr('fill', d => getSubjectColor(d));

    legendItem.append('text')
        .attr('x', 10)
        .attr('y', 3)
        .text(d => d)
        .style('font-size', '10px')
        .style('fill', '#333');

    // Restore zoom transform if it was stored and is not the default
    if (currentTransform && (currentTransform.k !== 1 || currentTransform.x !== 0 || currentTransform.y !== 0)) {
        // Apply transform immediately after the simulation starts for smoother experience
        svg.call(zoom.transform, currentTransform);
    }
}

// Drag behavior for moving nodes within the visualization
function drag(simulation) {
    function dragstarted(event) {
        // Store the original coordinates for potential moving operation
        event.subject.oldX = event.subject.x;
        event.subject.oldY = event.subject.y;
        if (!event.active) simulation.alphaTarget(0.1).restart(); // Reduced from 0.3 to 0.1 for smoother experience
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        // Check if we're dragging over a semester box
        const mouseX = event.sourceEvent.clientX;
        const mouseY = event.sourceEvent.clientY;
        
        // Check if mouse is over any semester box
        const semesterBoxes = document.querySelectorAll('.semester-content');
        let overSemesterBox = false;
        
        semesterBoxes.forEach(box => {
            const rect = box.getBoundingClientRect();
            
            if (mouseX >= rect.left && mouseX <= rect.right &&
                mouseY >= rect.top && mouseY <= rect.bottom) {
                overSemesterBox = true;
                
                // Check if this is a valid drop zone for the course
                const semesterId = box.parentElement.id;
                if (event.subject.type === 'course' && isValidDropZone(event.subject.id, semesterId)) {
                    box.classList.add('drag-over');
                } else {
                    box.classList.add('drag-over-invalid');
                }
            } else {
                box.classList.remove('drag-over');
                box.classList.remove('drag-over-invalid');
            }
        });
        
        // Allow node dragging to continue
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        
        // Get mouse position
        const mouseX = event.sourceEvent.clientX;
        const mouseY = event.sourceEvent.clientY;
        
        // Check if mouse is over any semester box
        const semesterBoxes = document.querySelectorAll('.semester-content');
        let targetBox = null;
        
        semesterBoxes.forEach(box => {
            const rect = box.getBoundingClientRect();
            
            if (mouseX >= rect.left && mouseX <= rect.right &&
                mouseY >= rect.top && mouseY <= rect.bottom) {
                targetBox = box;
            }
            box.classList.remove('drag-over');
            box.classList.remove('drag-over-invalid');
        });
        
        if (targetBox && event.subject.type === 'course') {
            // Drop to semester box functionality
            const course = courses.find(c => c.course_id === event.subject.id);
            if (course) {
                // Get semester ID
                const semesterId = targetBox.parentElement.id;
                
                // Validate prerequisite constraints before adding
                if (validateCourseScheduling(event.subject.id, semesterId)) {
                    // Prepare course data for semester
                    const courseData = {
                        id: event.subject.id,
                        title: event.subject.name.split('-')[1]?.trim() || event.subject.name,
                        credits: event.subject.credits, // Use credits from the node data which includes overrides
                        categoryId: findCategoryForCourse(event.subject.id)
                    };
                    
                    // Add course to semester directly without toggling selection
                    addCourseToSemesterWithoutUpdate(courseData, semesterId);
                    
                    // Mark this course as no longer visible in the graph but still selected
                    updateVisualizationWithoutCourse(event.subject.id);
                    
                    // Don't update spotlight mode - keep current state
                }
            }
        } else {
            // Regular node dragging (release the node)
        event.subject.fx = null;
        event.subject.fy = null;
        }
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

// Helper function to find category for a course
function findCategoryForCourse(courseId) {
    const courseLink = categoryCourses.find(cc => cc.course_id === courseId);
    return courseLink ? courseLink.category_id : null;
}

// Add course to semester without toggling selection
function addCourseToSemesterWithoutUpdate(courseData, semesterId) {
    // Check if course is already in a semester
    removeCourseFromAllSemesters(courseData.id);
    
    // Get the semester content area
    const semesterContent = document.querySelector(`#${semesterId} .semester-content`);
    if (!semesterContent) return;
    
    // Create course element with flexbox layout
    const courseElement = document.createElement('div');
    courseElement.className = 'timeline-course';
    courseElement.dataset.courseId = courseData.id;
    
    // Course info (left side)
    const courseInfo = document.createElement('span');
    courseInfo.className = 'course-info';
    courseInfo.textContent = `${courseData.id} (${courseData.credits} cr)`;
    
    // Remove button (right side)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-outline-danger course-remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove course';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeCourseFromSemester(courseData.id, semesterId);
        timelineCourses.delete(courseData.id);
        
        // Instead of rebuilding, add the course back to the visualization if it's selected
        if (selectedCourses.has(courseData.id) && selectedMajor) {
            addCourseBackToVisualization(courseData.id);
        }
    };
    
    courseElement.appendChild(courseInfo);
    courseElement.appendChild(removeBtn);
    
    // Add course to the semester
    semesterContent.appendChild(courseElement);
    
    // Update semester course tracking
    if (!semesterCourses.has(semesterId)) {
        semesterCourses.set(semesterId, new Map());
    }
    semesterCourses.get(semesterId).set(courseData.id, courseData);
    
    // Update semester credits
    updateSemesterCredits(semesterId);
    
    // Mark this course as in timeline
    timelineCourses.add(courseData.id);
    
    // Don't trigger visualization update here - let updateVisualizationWithoutCourse handle it
}

// Update visualization without showing a specific course
function updateVisualizationWithoutCourse(courseId) {
    // Add course to timeline tracking
    timelineCourses.add(courseId);
    
    // Instead of rebuilding the entire visualization, just hide the specific node
    const existingNodes = d3.selectAll('.node');
    const nodeToHide = existingNodes.filter(d => d.id === courseId);
    
    if (!nodeToHide.empty()) {
        // Smoothly fade out and remove the node
        nodeToHide.transition()
            .duration(300)
            .style('opacity', 0)
            .on('end', function() {
                d3.select(this).remove();
            });
        
        // Also remove any links connected to this node
        const linksToRemove = d3.selectAll('path[marker-end]').filter(l => 
            l.source.id === courseId || l.target.id === courseId
        );
        
        if (!linksToRemove.empty()) {
            linksToRemove.transition()
                .duration(300)
                .style('opacity', 0)
                .on('end', function() {
                    d3.select(this).remove();
                });
        }
    }
    
    // Store current spotlight state for potential restoration
    const wasSpotlightActive = spotlightMode;
    const currentSpotlight = currentSpotlightSemester;
    
    // Only restore spotlight if it was active and node removal didn't break it
    if (wasSpotlightActive && currentSpotlight) {
        setTimeout(() => {
            if (spotlightMode) { // Only if still in spotlight mode
                highlightAvailableCoursesForSemester(currentSpotlight);
            }
        }, 350); // After fade animation completes
    }
}

// Update category credits based on selected courses
function updateCategoryCredits(category) {
    const categoryId = category.category_id;
    
    // Get all courses in this category
    const categoryCoursesData = categoryCourses.filter(cc => cc.category_id === categoryId);
    const categoryCoursesIds = categoryCoursesData.map(cc => cc.course_id);
    
    // Calculate total credits from selected courses in this category
    let totalCredits = 0;
    categoryCoursesIds.forEach(courseId => {
        if (selectedCourses.has(courseId)) {
            const course = courses.find(c => c.course_id === courseId);
            if (course) {
                totalCredits += course.Credits; // Use the Credits from course object which includes overrides
            }
        }
    });
    
    // Update the category credits tracking
    categoryCredits.set(categoryId, totalCredits);
}

// Add a course back to the visualization smoothly
function addCourseBackToVisualization(courseId) {
    // Check if visualization exists and course isn't already there
    const existingSvg = d3.select('#visualization svg');
    if (existingSvg.empty()) return;
    
    const existingNode = d3.selectAll('.node').filter(d => d.id === courseId);
    if (!existingNode.empty()) return; // Already in visualization
    
    // Find the course data
    const course = courses.find(c => c.course_id === courseId);
    if (!course) return;
    
    // Get current simulation and add the new node
    const currentNodes = d3.selectAll('.node').data();
    const g = d3.select('#visualization svg g');
    const simulation = d3.select('#visualization svg').node().__simulation__;
    
    if (!simulation) {
        // If no simulation exists, fall back to rebuilding
        visualizeMajor(selectedMajor.major_id);
        return;
    }
    
    // Parse course number
    let courseNumber = 0;
    if (course.Number) {
        const numMatch = course.Number.match(/(\d+)/);
        if (numMatch && numMatch[1]) {
            courseNumber = parseInt(numMatch[1], 10);
        }
    }
    
    // Create new node data
    const newNodeData = {
        id: course.course_id,
        name: course.Name,
        type: 'course',
        subject: course.Subject,
        size: 60,
        courseNumber: courseNumber,
        level: 0, // Will be calculated if needed
        credits: course.Credits,
        x: Math.random() * 200 + 100, // Random starting position
        y: Math.random() * 200 + 100
    };
    
    // Add the new node to the visualization
    const newNode = g.select('.node').select(function() { return this.parentNode; })
        .append('g')
        .datum(newNodeData)
        .attr('class', 'node')
        .style('opacity', 0)
        .attr('transform', `translate(${newNodeData.x},${newNodeData.y})`);
    
    // Add circle
    newNode.append('circle')
        .attr('r', newNodeData.size)
        .attr('fill', getSubjectColor(newNodeData.subject))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 5px rgba(0,0,0,0.3))');
    
    // Add text
    newNode.append('text')
        .attr('dy', 5)
        .attr('text-anchor', 'middle')
        .text(newNodeData.id)
        .style('fill', '#fff')
        .style('font-size', '16px')
        .style('pointer-events', 'none')
        .style('font-weight', 'bold');
    
    // Fade in the new node
    newNode.transition()
        .duration(500)
        .style('opacity', 1);
}

// Add a course to the visualization smoothly (for checkbox selection)
function addCourseToVisualizationSmoothly(courseId) {
    // Check if visualization exists and course isn't already there
    const existingSvg = d3.select('#visualization svg');
    if (existingSvg.empty()) {
        // No visualization exists yet, rebuild it
        if (selectedMajor) {
            visualizeMajor(selectedMajor.major_id);
        }
        return;
    }
    
    const existingNode = d3.selectAll('.node').filter(d => d.id === courseId);
    if (!existingNode.empty()) return; // Already in visualization
    
    // Find the course data
    const course = courses.find(c => c.course_id === courseId);
    if (!course) return;
    
    // Get current simulation and container
    const g = d3.select('#visualization svg g');
    const simulation = d3.select('#visualization svg').node().__simulation__;
    
    if (!simulation) {
        // If no simulation exists, fall back to rebuilding
        if (selectedMajor) {
            visualizeMajor(selectedMajor.major_id);
        }
        return;
    }
    
    // Parse course number
    let courseNumber = 0;
    if (course.Number) {
        const numMatch = course.Number.match(/(\d+)/);
        if (numMatch && numMatch[1]) {
            courseNumber = parseInt(numMatch[1], 10);
        }
    }
    
    // Calculate level based on prerequisites
    let level = 0;
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    for (const prereq of coursePrereqs) {
        const prereqNode = d3.selectAll('.node').filter(d => d.id === prereq.prerequisite_id);
        if (!prereqNode.empty()) {
            const prereqData = prereqNode.datum();
            if (prereqData && prereqData.level !== undefined) {
                level = Math.max(level, prereqData.level + 1);
            }
        }
    }
    
    // Get container dimensions for positioning
    const container = document.getElementById('visualization');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 10, right: 10, bottom: 30, left: 10 };
    
    // Calculate position based on course number and level (similar to original logic)
    const xScale = d3.scaleLinear()
        .domain([0, 4999])
        .range([margin.left + 50, width - margin.right - 50]);
    
    const basePosition = xScale(courseNumber);
    const prereqShift = level * 120;
    const xPosition = basePosition + prereqShift;
    
    // Y position with some variation
    const subjectHash = course.Subject ? course.Subject.charCodeAt(0) % 3 : 0;
    const numberHash = (courseNumber % 100) / 100;
    const levelOffset = level * 70;
    const spreadFactor = (subjectHash - 1) * 60 + (numberHash - 0.5) * 120;
    const yPosition = (height / 2) + levelOffset + spreadFactor;
    
    // Create new node data (but don't add to simulation yet)
    const newNodeData = {
        id: course.course_id,
        name: course.Name,
        type: 'course',
        subject: course.Subject,
        size: 60,
        courseNumber: courseNumber,
        level: level,
        credits: course.Credits,
        x: xPosition,
        y: yPosition,
        fx: null,
        fy: null
    };
    
    // Create the visual node element without updating simulation data
    const newNode = g.append('g')
        .datum(newNodeData)
        .attr('class', 'node')
        .style('opacity', 0)
        .attr('transform', `translate(${xPosition},${yPosition})`)
        .call(drag(simulation));
    
    // Add circle
    newNode.append('circle')
        .attr('r', d => d.size)
        .attr('fill', d => getSubjectColor(d.subject))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 5px rgba(0,0,0,0.3))');
    
    // Add text
    newNode.append('text')
        .attr('dy', 5)
        .attr('text-anchor', 'middle')
        .text(d => d.id)
        .style('fill', '#fff')
        .style('font-size', '16px')
        .style('pointer-events', 'none')
        .style('font-weight', 'bold');
    
    // Add hover events
    newNode.on('mouseover', function(event, d) {
        if (d.type === 'course') {
            // Show tooltip
            const tooltip = d3.select('#tooltip');
            tooltip.style('opacity', 1);
            tooltip.html(`
                <strong>${d.id}</strong><br>
                ${d.name}
            `);
            
            // Position the tooltip near the node
            tooltip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 28) + 'px');
            
            // Only highlight connections if spotlight mode is NOT active
            if (!spotlightMode) {
                highlightConnections(d.id);
            }
        }
    })
    .on('mouseout', function(event, d) {
        // Hide tooltip
        const tooltip = d3.select('#tooltip');
        tooltip.style('opacity', 0);
        
        // Only remove connection highlighting if spotlight mode is NOT active
        if (d.type === 'course' && !spotlightMode) {
            removeHighlighting();
        }
    })
    .on('click', function(event, d) {
        // Single click: add to spotlight semester if in spotlight mode
        if (spotlightMode && currentSpotlightSemester && d.type === 'course') {
            event.stopPropagation();
            addCourseToSpotlightSemester(d.id);
        }
    })
    .on('dblclick', function(event, d) {
        // Double click: show course information
        if (d.type === 'course') {
            event.stopPropagation();
            showCourseInformation(d.id);
        }
    });
    
    // Add prerequisite links if they should exist
    const allCurrentNodes = d3.selectAll('.node').data();
    const newLinks = [];
    
    // Add prerequisite links for this course
    const newCoursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    newCoursePrereqs.forEach(prereq => {
        const prereqExists = allCurrentNodes.some(n => n.id === prereq.prerequisite_id);
        if (prereqExists) {
            // Add visual link without updating simulation
            g.append('path')
                .datum({
                    source: { id: prereq.prerequisite_id },
                    target: { id: courseId }
                })
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('marker-end', 'url(#arrowhead)')
                .style('opacity', 0)
                .on('mouseover', function() {
                    d3.select(this)
                        .attr('stroke-width', 3)
                        .attr('stroke-opacity', 1);
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .attr('stroke-width', 2)
                        .attr('stroke-opacity', 0.6);
                })
                .transition()
                .duration(500)
                .style('opacity', 0.6);
        }
    });
    
    // Add links where this course is a prerequisite
    const dependentCourses = prerequisites.filter(p => p.prerequisite_id === courseId);
    dependentCourses.forEach(dep => {
        const depExists = allCurrentNodes.some(n => n.id === dep.course_id);
        if (depExists) {
            // Add visual link without updating simulation
            g.append('path')
                .datum({
                    source: { id: courseId },
                    target: { id: dep.course_id }
                })
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('marker-end', 'url(#arrowhead)')
                .style('opacity', 0)
                .on('mouseover', function() {
                    d3.select(this)
                        .attr('stroke-width', 3)
                        .attr('stroke-opacity', 1);
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .attr('stroke-width', 2)
                        .attr('stroke-opacity', 0.6);
                })
                .transition()
                .duration(500)
                .style('opacity', 0.6);
        }
    });
    
    // Fade in the new node
    newNode.transition()
        .duration(500)
        .style('opacity', 1);
    
    // No simulation updates at all - keep everything static to avoid view reset
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeSemanticSearch();
}); 

// Initialize semantic search functionality
function initializeSemanticSearch() {
    const semanticSearchBtn = document.getElementById('semanticSearchBtn');
    if (semanticSearchBtn) {
        semanticSearchBtn.addEventListener('click', openSemanticSearchModal);
    }
}

// Open the semantic search modal
function openSemanticSearchModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'semantic-modal-overlay';
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeSemanticSearchModal();
        }
    };
    
    const modalContent = document.createElement('div');
    modalContent.className = 'semantic-modal-content';
    
    modalContent.innerHTML = `
        <div class="semantic-modal-header">
            <h2>
                <i class="fas fa-brain"></i>
                AI Course Search
            </h2>
            <button class="semantic-modal-close" onclick="closeSemanticSearchModal()">&times;</button>
        </div>
        <div class="semantic-modal-body">
            <div class="semantic-input-section">
                <label for="semanticInput">What are you looking to learn or what career are you interested in?</label>
                <textarea 
                    id="semanticInput" 
                    placeholder="For example: 'I want to become a data scientist' or 'I'm interested in cybersecurity' or 'I need courses about machine learning and AI'"
                ></textarea>
            </div>
            <button class="semantic-search-button" onclick="performSemanticSearch()">
                <i class="fas fa-search"></i> Find Relevant Courses
            </button>
            <div id="semanticResults"></div>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Add fade-in animation
    setTimeout(() => {
        modalOverlay.classList.add('show');
        // Focus on the textarea
        const textarea = document.getElementById('semanticInput');
        if (textarea) {
            textarea.focus();
            textarea.value = ''; // Clear any previous input
        }
        
        // Clear any previous results
        const resultsContainer = document.getElementById('semanticResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }, 10);
    
    // Add Enter key listener for textarea
    document.getElementById('semanticInput').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            performSemanticSearch();
        }
    });
}

// Close the semantic search modal
function closeSemanticSearchModal() {
    const modal = document.querySelector('.semantic-modal-overlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Perform semantic search using OpenAI API
async function performSemanticSearch() {
    const input = document.getElementById('semanticInput').value.trim();
    const resultsContainer = document.getElementById('semanticResults');
    const searchButton = document.querySelector('.semantic-search-button');
    
    console.log('Starting semantic search with input:', input); // Debug log
    
    if (!input) {
        alert('Please describe what you\'re looking to learn or your career interests.');
        return;
    }
    
    // Clear any previous results immediately
    resultsContainer.innerHTML = '';
    
    // Disable button and show loading
    searchButton.disabled = true;
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    
    resultsContainer.innerHTML = `
        <div class="semantic-loading">
            <div class="semantic-spinner"></div>
            <span>AI is analyzing your request and finding relevant courses...</span>
        </div>
    `;
    
    try {
        // Step 1: Get keywords from OpenAI
        console.log('Calling getSearchKeywords...'); // Debug log
        const keywords = await getSearchKeywords(input);
        console.log('Generated keywords:', keywords);
        
        // Step 2: Perform semantic search on courses
        console.log('Performing course search...'); // Debug log
        const rankedCourses = performCourseSemanticSearch(keywords, input);
        console.log('Ranked courses:', rankedCourses);
        
        // Step 3: Display results
        console.log('Displaying results...'); // Debug log
        displaySemanticResults(rankedCourses, keywords);
        
    } catch (error) {
        console.error('Semantic search error:', error);
        resultsContainer.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> Unable to process your request. ${error.message || 'Please try again later.'}
            </div>
        `;
    } finally {
        // Re-enable button
        searchButton.disabled = false;
        searchButton.innerHTML = '<i class="fas fa-search"></i> Find Relevant Courses';
    }
}

// Get search keywords from OpenAI API
async function getSearchKeywords(userInput) {
    try {
        console.log('Making API call for input:', userInput); // Debug log
        
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache', // Prevent caching
            },
            body: JSON.stringify({ 
                query: userInput,
                timestamp: Date.now() // Add timestamp to ensure unique requests
            })
        });
        
        console.log('API response status:', response.status); // Debug log
        
        if (!response.ok) {
            throw new Error('Failed to get course recommendations');
        }
        
        const data = await response.json();
        console.log('API response data:', data); // Debug log
        return data.keywords;
    } catch (error) {
        console.error('API call failed, falling back to local analysis:', error);
        // Fallback to local analysis if API fails
        return await simulateOpenAIAnalysis(userInput);
    }
}

// Simulate OpenAI analysis for demo purposes
async function simulateOpenAIAnalysis(userInput) {
    // Add a delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const input = userInput.toLowerCase();
    console.log('Simulating analysis for input:', input); // Debug log
    
    // Career/interest to keywords mapping
    const keywordMappings = {
        'biolog': ['biology', 'life sciences', 'genetics', 'molecular biology', 'anatomy', 'physiology', 'ecology', 'biochemistry'],
        'chemistry': ['chemistry', 'organic chemistry', 'inorganic chemistry', 'physical chemistry', 'biochemistry', 'laboratory', 'analytical'],
        'physics': ['physics', 'mechanics', 'thermodynamics', 'electromagnetism', 'quantum mechanics', 'optics', 'laboratory'],
        'data scien': ['statistics', 'machine learning', 'data analysis', 'python', 'programming', 'database', 'mathematics', 'linear algebra', 'calculus', 'probability'],
        'cybersecurity': ['security', 'network', 'cryptography', 'systems', 'computer systems', 'information security', 'programming', 'operating systems'],
        'software engineer': ['programming', 'software development', 'algorithms', 'data structures', 'computer science', 'object oriented', 'software design', 'databases'],
        'web develop': ['web programming', 'javascript', 'html', 'css', 'database', 'programming', 'software engineering', 'user interface'],
        'artificial intelligence': ['machine learning', 'neural networks', 'algorithms', 'mathematics', 'programming', 'statistics', 'computer science'],
        'machine learning': ['statistics', 'mathematics', 'algorithms', 'programming', 'linear algebra', 'calculus', 'data analysis'],
        'game develop': ['programming', 'computer graphics', 'software engineering', 'mathematics', 'algorithms', 'computer science'],
        'mobile app': ['programming', 'software development', 'user interface', 'mobile computing', 'app development'],
        'network': ['networking', 'computer networks', 'systems administration', 'security', 'telecommunications'],
        'database': ['database design', 'data management', 'sql', 'data structures', 'information systems'],
        'business': ['business', 'management', 'economics', 'finance', 'marketing', 'accounting'],
        'math': ['mathematics', 'calculus', 'linear algebra', 'statistics', 'discrete mathematics', 'probability'],
        'engineer': ['engineering', 'mathematics', 'physics', 'problem solving', 'design', 'systems'],
        'psycholog': ['psychology', 'human behavior', 'cognitive science', 'social psychology', 'research methods', 'statistics'],
        'sociol': ['sociology', 'social science', 'human society', 'social research', 'cultural studies', 'social theory'],
        'english': ['english', 'literature', 'writing', 'composition', 'rhetoric', 'communication', 'critical thinking'],
        'history': ['history', 'historical analysis', 'research methods', 'cultural studies', 'social studies', 'critical thinking'],
        'economics': ['economics', 'microeconomics', 'macroeconomics', 'statistics', 'mathematical analysis', 'policy analysis'],
        'accounting': ['accounting', 'financial accounting', 'managerial accounting', 'auditing', 'taxation', 'business'],
        'marketing': ['marketing', 'consumer behavior', 'market research', 'advertising', 'business strategy', 'communication'],
        'finance': ['finance', 'financial analysis', 'investment', 'banking', 'risk management', 'economics'],
        'education': ['education', 'teaching', 'learning theory', 'curriculum', 'pedagogy', 'child development'],
        'art': ['art', 'visual arts', 'design', 'creativity', 'art history', 'studio arts', 'aesthetics'],
        'music': ['music', 'music theory', 'composition', 'performance', 'music history', 'audio production'],
        'health': ['health', 'public health', 'healthcare', 'medicine', 'health promotion', 'epidemiology', 'nutrition']
    };
    
    let keywords = [];
    
    // Find matching keywords based on input
    for (const [key, keywordList] of Object.entries(keywordMappings)) {
        if (input.includes(key)) {
            keywords = [...keywordList]; // Create a fresh copy
            console.log('Found match for:', key, 'Keywords:', keywords);
            break;
        }
    }
    
    // If no specific match, extract general keywords
    if (keywords.length === 0) {
        if (input.includes('program') || input.includes('code') || input.includes('computer') || input.includes('software')) {
            keywords = ['programming', 'computer science', 'software development', 'algorithms', 'problem solving'];
        } else if (input.includes('business') || input.includes('manage') || input.includes('entrepreneur')) {
            keywords = ['business', 'management', 'economics', 'communication', 'leadership'];
        } else if (input.includes('science') || input.includes('research')) {
            keywords = ['scientific method', 'research', 'analysis', 'critical thinking', 'mathematics'];
        } else {
            // Default broad search
            keywords = ['critical thinking', 'problem solving', 'analysis', 'communication', 'research methods'];
        }
        console.log('Using fallback keywords for input:', input, 'Keywords:', keywords);
    }
    
    // Remove duplicates and limit to top 8 keywords
    keywords = [...new Set(keywords)].slice(0, 8);
    
    console.log('Final keywords for', input, ':', keywords);
    return keywords;
}

// Perform semantic search on courses using keywords
function performCourseSemanticSearch(keywords, originalQuery) {
    if (!courses || courses.length === 0) {
        return [];
    }
    
    const scoredCourses = courses.map(course => {
        const searchText = `${course.Name} ${course.Description || ''}`.toLowerCase();
        const courseId = course.course_id.toLowerCase();
        
        let score = 0;
        let matchedKeywords = [];
        
        // Score based on keyword matches
        keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            
            // Higher score for exact matches in course name
            if (course.Name.toLowerCase().includes(keywordLower)) {
                score += 10;
                matchedKeywords.push(keyword);
            }
            
            // Medium score for matches in description
            if (course.Description && course.Description.toLowerCase().includes(keywordLower)) {
                score += 5;
                if (!matchedKeywords.includes(keyword)) {
                    matchedKeywords.push(keyword);
                }
            }
            
            // Lower score for partial matches
            if (searchText.includes(keywordLower.substring(0, 4))) {
                score += 2;
            }
        });
        
        // Bonus for ITSC courses (assuming computer science focus)
        if (course.Subject === 'ITSC') {
            score += 3;
        }
        
        // Bonus for MATH and STAT courses for data science queries
        if ((course.Subject === 'MATH' || course.Subject === 'STAT') && 
            keywords.some(k => ['statistics', 'mathematics', 'data analysis', 'calculus', 'linear algebra'].includes(k))) {
            score += 4;
        }
        
        return {
            course,
            score,
            matchedKeywords,
            relevancePercentage: Math.min(100, Math.round((score / keywords.length) * 10))
        };
    });
    
    // Filter courses with score > 0 and sort by score
    return scoredCourses
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15); // Limit to top 15 results
}

// Display semantic search results
function displaySemanticResults(rankedCourses, keywords) {
    const resultsContainer = document.getElementById('semanticResults');
    
    if (rankedCourses.length === 0) {
        resultsContainer.innerHTML = `
            <div class="semantic-results">
                <h3>No Relevant Courses Found</h3>
                <p>Try rephrasing your search or using different keywords. Consider being more specific about the subject area or career path you're interested in.</p>
            </div>
        `;
        return;
    }
    
    const keywordsList = keywords.map(k => `<span class="badge bg-primary me-1">${k}</span>`).join('');
    
    const resultsHTML = `
        <div class="semantic-results">
            <h3>Recommended Courses</h3>
            <div class="mb-3">
                <small class="text-muted">Based on keywords: ${keywordsList}</small>
            </div>
            ${rankedCourses.map(item => createCourseResultHTML(item)).join('')}
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
}

// Create HTML for a single course result
function createCourseResultHTML(courseItem) {
    const { course, score, matchedKeywords, relevancePercentage } = courseItem;
    const truncatedDescription = course.Description ? 
        (course.Description.length > 200 ? course.Description.substring(0, 200) + '...' : course.Description) :
        'No description available.';
    
    const matchedKeywordsBadges = matchedKeywords.map(k => 
        `<span class="badge bg-success me-1">${k}</span>`
    ).join('');
    
    return `
        <div class="course-result" onclick="showCourseInformation('${course.course_id}')">
            <div class="course-result-header">
                <div class="course-result-id">${course.course_id}</div>
                <div class="course-result-relevance">${relevancePercentage}% match</div>
            </div>
            <div class="course-result-name">${course.Name}</div>
            <div class="course-result-description">${truncatedDescription}</div>
            ${matchedKeywords.length > 0 ? `
                <div class="mt-2">
                    <small class="text-muted">Matched: ${matchedKeywordsBadges}</small>
                </div>
            ` : ''}
            <div class="course-result-actions">
                <button class="course-result-btn" onclick="event.stopPropagation(); addCourseFromSemanticSearch('${course.course_id}')">
                    <i class="fas fa-plus"></i> Add to Plan
                </button>
                <button class="course-result-btn" onclick="event.stopPropagation(); showCourseInformation('${course.course_id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            </div>
        </div>
    `;
}

// Add a course from semantic search results
function addCourseFromSemanticSearch(courseId) {
    if (!selectedMajor) {
        alert('Please select a major first to add courses to your plan.');
        return;
    }
    
    // Check if course is already selected
    if (selectedCourses.has(courseId)) {
        alert('This course is already in your plan.');
        return;
    }
    
    // Find the course
    const course = courses.find(c => c.course_id === courseId);
    if (!course) {
        alert('Course not found.');
        return;
    }
    
    // Find which category this course belongs to (if any)
    const categoryLink = categoryCourses.find(cc => cc.course_id === courseId);
    let category = null;
    
    if (categoryLink) {
        category = majorCategories.find(cat => cat.category_id === categoryLink.category_id);
    }
    
    // Add the course to selected courses
    selectedCourses.add(courseId);
    
    // Update the checkbox in the sidebar if it exists
    const checkbox = document.getElementById(`checkbox-${courseId}`);
    if (checkbox) {
        checkbox.checked = true;
    }
    
    // Add to visualization if not in timeline
    if (!timelineCourses.has(courseId)) {
        addCourseToVisualizationSmoothly(courseId);
    }
    
    // Update category credits and status only if course belongs to a category in this major
    if (category) {
        updateCategoryCredits(category);
        updateCategoryStatus(category);
    }
    
    // Show success message
    const courseResultElement = document.querySelector(`.course-result[onclick*="${courseId}"]`);
    if (courseResultElement) {
        const originalHTML = courseResultElement.innerHTML;
        courseResultElement.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #28a745;">
                <i class="fas fa-check-circle fa-2x"></i>
                <div style="margin-top: 10px; font-weight: 500;">Added to your plan!</div>
            </div>
        `;
        
        setTimeout(() => {
            courseResultElement.innerHTML = originalHTML;
        }, 2000);
    }
}

// Toggle semester spotlight mode
function toggleSemesterSpotlight(semesterId) {
    if (spotlightMode && currentSpotlightSemester === semesterId) {
        // Turn off spotlight mode
        spotlightMode = false;
        currentSpotlightSemester = null;
        removeSpotlighting();
        
        // Remove visual indication from semester header
        const header = document.querySelector(`#${semesterId} .semester-header`);
        if (header) {
            header.classList.remove('semester-spotlight-active');
        }
    } else {
        // Turn on spotlight mode for this semester
        spotlightMode = true;
        currentSpotlightSemester = semesterId;
        highlightAvailableCoursesForSemester(semesterId);
        
        // Remove previous spotlight styling
        document.querySelectorAll('.semester-header').forEach(h => {
            h.classList.remove('semester-spotlight-active');
        });
        
        // Add visual indication to clicked semester header
        const header = document.querySelector(`#${semesterId} .semester-header`);
        if (header) {
            header.classList.add('semester-spotlight-active');
        }
    }
}

// Highlight courses available for a specific semester (no prerequisites on screen)
function highlightAvailableCoursesForSemester(semesterId) {
    if (!selectedMajor) return;
    
    // Get all currently visible course nodes
    const allNodes = d3.selectAll('.node');
    
    // Find courses that can actually be placed in this semester
    const availableCourseIds = new Set();
    
    allNodes.each(function(d) {
        if (d.type === 'course') {
            // Check if this course can be validly placed in this semester
            if (canCourseBeScheduledInSemester(d.id, semesterId)) {
                availableCourseIds.add(d.id);
            }
        }
    });
    
    // Apply spotlight effect
    allNodes.style('opacity', d => {
        if (d.type === 'root') return 1; // Keep root visible
        return availableCourseIds.has(d.id) ? 1 : 0.3;
    });
    
    // Also fade links
    d3.selectAll('path[marker-end]').style('opacity', 0.2);
}

// Check if a course can be scheduled in a specific semester (comprehensive check)
function canCourseBeScheduledInSemester(courseId, targetSemesterId) {
    // Check if course is already scheduled somewhere
    if (findCourseInSemesters(courseId)) {
        return false; // Already scheduled
    }
    
    // Get all prerequisites for this course
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    
    if (coursePrereqs.length === 0) {
        return true; // No prerequisites, can be scheduled
    }
    
    // Check if all prerequisites are satisfied
    for (const prereq of coursePrereqs) {
        const prereqSemester = findCourseInSemesters(prereq.prerequisite_id);
        
        if (!prereqSemester) {
            // Prerequisite is not scheduled yet
            // Check if the prerequisite is visible in the current visualization
            const allNodes = d3.selectAll('.node');
            const prereqIsVisible = allNodes.data().some(node => node.id === prereq.prerequisite_id);
            
            if (prereqIsVisible) {
                // Prerequisite is visible but not scheduled, so this course can't be scheduled yet
                return false;
            }
            // If prerequisite is not visible, we assume it's either taken elsewhere or not required for this visualization
            continue;
        }
        
        // Prerequisite is scheduled, check if it's in an earlier semester
        const prereqOrder = getSemesterOrder(prereqSemester);
        const targetOrder = getSemesterOrder(targetSemesterId);
        
        if (prereqOrder >= targetOrder) {
            return false; // Prerequisite is scheduled same time or later
        }
    }
    
    return true; // All checks passed
}

// Remove spotlight highlighting
function removeSpotlighting() {
    if (!selectedMajor) return;
    
    // Only reset to normal state if no other highlighting is active
    d3.selectAll('.node').style('opacity', 1);
    d3.selectAll('path[marker-end]').style('opacity', 0.6);
    
    // Reset any stroke width changes from connection highlighting
    d3.selectAll('path[marker-end]').style('stroke-width', 2);
}

// Validate if a course can be scheduled in a specific semester
function validateCourseScheduling(courseId, targetSemesterId) {
    // Get all prerequisites for this course
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    
    if (coursePrereqs.length === 0) {
        return true; // No prerequisites, can be scheduled anywhere
    }
    
    // Check if any prerequisites are scheduled in the same semester or later
    for (const prereq of coursePrereqs) {
        const prereqSemester = findCourseInSemesters(prereq.prerequisite_id);
        
        if (prereqSemester) {
            const prereqOrder = getSemesterOrder(prereqSemester);
            const targetOrder = getSemesterOrder(targetSemesterId);
            
            if (prereqOrder >= targetOrder) {
                // Show error message
                showPrerequisiteError(courseId, prereq.prerequisite_id, targetSemesterId);
                return false;
            }
        }
    }
    
    return true;
}

// Helper function to check if a course is placed in a semester or earlier
function isCoursePlacedInSemesterOrEarlier(courseId, semesterId) {
    const targetOrder = getSemesterOrder(semesterId);
    
    for (const [scheduledSemesterId, coursesMap] of semesterCourses) {
        if (coursesMap.has(courseId)) {
            const scheduledOrder = getSemesterOrder(scheduledSemesterId);
            if (scheduledOrder <= targetOrder) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper function to find which semester a course is scheduled in
function findCourseInSemesters(courseId) {
    for (const [semesterId, coursesMap] of semesterCourses) {
        if (coursesMap.has(courseId)) {
            return semesterId;
        }
    }
    return null;
}

// Helper function to get semester order for comparison
function getSemesterOrder(semesterId) {
    // Extract year and semester from ID like "semester-fall-2024"
    const parts = semesterId.split('-');
    const semester = parts[1]; // 'fall' or 'spring'
    const year = parseInt(parts[2]);
    
    // Spring = .0, Fall = .5 (so Fall 2024 comes before Spring 2025)
    return year + (semester === 'spring' ? 0 : 0.5);
}

// Show prerequisite error message
function showPrerequisiteError(courseId, prerequisiteId, targetSemesterId) {
    const semesterName = document.querySelector(`#${targetSemesterId} .semester-header`).textContent;
    
    // Create and show error modal or alert
    const errorMessage = `Cannot schedule ${courseId} in ${semesterName}.\n\nPrerequisite ${prerequisiteId} must be completed in an earlier semester.`;
    
    // Simple alert for now - could be enhanced with a modal
    alert(errorMessage);
    
    // Optional: Highlight the conflicting courses temporarily
    highlightPrerequisiteConflict(courseId, prerequisiteId);
}

// Optional: Highlight the prerequisite conflict in the visualization
function highlightPrerequisiteConflict(courseId, prerequisiteId) {
    const courseNode = d3.selectAll('.node').filter(d => d.id === courseId);
    const prerequisiteNode = d3.selectAll('.node').filter(d => d.id === prerequisiteId);

    if (courseNode.empty() || prerequisiteNode.empty()) {
        console.warn('Could not find nodes for prerequisite conflict highlighting:', courseId, prerequisiteId);
        return;
    }

    // Temporarily increase opacity of the conflicting nodes and links
    courseNode.style('opacity', 1).style('stroke', 'red').style('stroke-width', 3);
    prerequisiteNode.style('opacity', 1).style('stroke', 'red').style('stroke-width', 3);

    // Find the link between them
    const link = d3.selectAll('path[marker-end]').filter(l => 
        (l.source.id === prerequisiteId && l.target.id === courseId) ||
        (l.source.id === courseId && l.target.id === prerequisiteId)
    );

    if (!link.empty()) {
        link.style('stroke', 'red');
        link.style('stroke-width', 4);
        link.style('stroke-opacity', 1);
    }

    // After a short delay, revert to original styling
    setTimeout(() => {
        courseNode.style('stroke', '#fff').style('stroke-width', 2);
        prerequisiteNode.style('stroke', '#fff').style('stroke-width', 2);
        if (!link.empty()) {
            link.style('stroke', '#999');
            link.style('stroke-width', 2);
            link.style('stroke-opacity', 0.6);
        }
    }, 3000); // 3 seconds
} 

// Check if a semester is a valid drop zone for a course (used during drag)
function isValidDropZone(courseId, targetSemesterId) {
    // Get all prerequisites for this course
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    
    if (coursePrereqs.length === 0) {
        return true; // No prerequisites, can be scheduled anywhere
    }
    
    // Check if any prerequisites are scheduled in the same semester or later
    for (const prereq of coursePrereqs) {
        const prereqSemester = findCourseInSemesters(prereq.prerequisite_id);
        
        if (prereqSemester) {
            const prereqOrder = getSemesterOrder(prereqSemester);
            const targetOrder = getSemesterOrder(targetSemesterId);
            
            if (prereqOrder >= targetOrder) {
                return false; // Invalid drop zone
            }
        }
    }
    
    return true; // Valid drop zone
} 

// Add course to the currently spotlighted semester
function addCourseToSpotlightSemester(courseId) {
    if (!spotlightMode || !currentSpotlightSemester) {
        return; // Not in spotlight mode
    }
    
    // Validate that this course can be scheduled in the spotlight semester
    if (!canCourseBeScheduledInSemester(courseId, currentSpotlightSemester)) {
        // Show error for invalid scheduling
        const semesterName = document.querySelector(`#${currentSpotlightSemester} .semester-header`).textContent;
        alert(`Cannot schedule ${courseId} in ${semesterName}. Check prerequisite requirements.`);
        return;
    }
    
    // Find the course data
    const course = courses.find(c => c.course_id === courseId);
    if (!course) return;
    
    // Prepare course data for semester
    const courseData = {
        id: courseId,
        title: course.Name.split('-')[1]?.trim() || course.Name,
        credits: course.Credits,
        categoryId: findCategoryForCourse(courseId)
    };
    
    // Add course to the spotlight semester
    addCourseToSemesterWithoutUpdate(courseData, currentSpotlightSemester);
    
    // Remove the course from visualization
    updateVisualizationWithoutCourse(courseId);
}

// Show detailed course information in a modal
function showCourseInformation(courseId) {
    // Find the course data
    const course = courses.find(c => c.course_id === courseId);
    if (!course) return;
    
    console.log('Course data for modal:', course); // Debug log to check course data
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'course-modal-overlay';
    modalOverlay.onclick = () => closeCourseModal();
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'course-modal-content';
    modalContent.onclick = (e) => e.stopPropagation(); // Prevent closing when clicking content
    
    // Find prerequisites for this course
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    const prereqList = coursePrereqs.map(p => p.prerequisite_id).join(', ') || 'None';
    
    // Find courses that have this as a prerequisite
    const dependentCourses = prerequisites.filter(p => p.prerequisite_id === courseId);
    const dependentList = dependentCourses.map(p => p.course_id).join(', ') || 'None';
    
    // Find which category this course belongs to
    const categoryLink = categoryCourses.find(cc => cc.course_id === courseId);
    let categoryInfo = 'Not categorized';
    if (categoryLink) {
        const category = majorCategories.find(cat => cat.category_id === categoryLink.category_id);
        if (category) {
            categoryInfo = category.category_name;
        }
    }
    
    modalContent.innerHTML = `
        <div class="course-modal-header">
            <h2>${course.course_id}</h2>
            <button class="course-modal-close" onclick="closeCourseModal()">&times;</button>
        </div>
        <div class="course-modal-body">
            <h3>${course.Name}</h3>
            
            <div class="course-info-grid">
                <div class="course-info-item">
                    <strong>Credits:</strong> ${course.Credits}
                </div>
                <div class="course-info-item">
                    <strong>Category:</strong> ${categoryInfo}
                </div>
            </div>
            
            <div class="course-prereq-section">
                <h4>Prerequisites:</h4>
                <p>${prereqList}</p>
            </div>
            
            <div class="course-dependent-section">
                <h4>Required for:</h4>
                <p>${dependentList}</p>
            </div>
            
            <div class="course-description-section">
                <h4>Description:</h4>
                <p>${course.Description || 'No description available.'}</p>
            </div>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Add fade-in animation
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10);
}

// Close the course information modal
function closeCourseModal() {
    const modal = document.querySelector('.course-modal-overlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300); // Wait for fade-out animation
    }
} 