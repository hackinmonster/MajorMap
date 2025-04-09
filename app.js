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
            
            console.log('Parsed credits:', credits);
            
            return {
                course_id: course_id,
                Name: d.Name,
                Subject: d.Subject,
                Number: d.Number,
                Credits: credits || 3 // Default to 3 credits if not specified
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
        results.forEach(major => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `<i class="fas fa-graduation-cap me-2"></i>${major.major_name}`;
            item.onclick = () => selectMajor(major);
            searchResults.appendChild(item);
        });

        searchResults.style.display = results.length > 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', performSearch);
    searchButton.addEventListener('click', performSearch);
}

// Handle major selection
function selectMajor(major) {
    selectedMajor = major;
    selectedCourses.clear(); // Clear selected courses when changing majors
    categoryCredits.clear(); // Clear category credits
    
    document.getElementById('majorSearch').value = major.major_name;
    document.getElementById('searchResults').style.display = 'none';
    
    // Initialize the sidebar and visualization
    initializeSidebar(major.major_id);
    visualizeMajor(major.major_id);
}

// Initialize sidebar with categories and courses
function initializeSidebar(majorId) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = ''; // Clear existing content

    // Get categories for this major
    const categories = majorCategories.filter(cat => cat.major_id === majorId);
    
    // Create sections for each category
    categories.forEach(category => {
        // Initialize credits tracking for this category
        const requiredCredits = parseInt(category.credits_required) || 0;
        console.log('Category credits initialization:', category.category_name, requiredCredits);
        categoryCredits.set(category.category_id, requiredCredits);
        
        // Create category section
        const section = document.createElement('div');
        section.className = 'category-section';
        
        // Add category title
        const title = document.createElement('div');
        title.className = 'category-title';
        title.textContent = category.category_name;
        
        // Add credits counter
        const credits = document.createElement('div');
        credits.className = 'credits-needed';
        credits.id = `credits-${category.category_id}`;
        credits.textContent = `Credits still needed: ${requiredCredits}`;
        
        // Create course list
        const courseList = document.createElement('ul');
        courseList.className = 'course-list';
        
        // Get courses for this category
        const categoryCoursesList = categoryCourses.filter(cc => cc.category_id === category.category_id);
        categoryCoursesList.forEach(courseLine => {
            const course = courses.find(c => c.course_id === courseLine.course_id);
            if (course) {
                const courseItem = document.createElement('li');
                courseItem.className = 'course-item';
                
                // Course name with credits
                const courseName = document.createElement('span');
                const courseTitle = course.Name.split('-')[1]?.trim() || course.Name;
                const courseCredits = parseInt(course.Credits) || 0;
                console.log('Course display credits:', course.course_id, courseCredits);
                courseName.textContent = `${course.course_id} - ${courseTitle} (${courseCredits} cr)`;
                
                // Selection bubble
                const bubble = document.createElement('div');
                bubble.className = 'course-bubble';
                bubble.dataset.courseId = course.course_id;
                bubble.dataset.categoryId = category.category_id;
                bubble.dataset.credits = courseCredits;
                
                // Add click handler
                bubble.addEventListener('click', () => toggleCourse(bubble, course, category));
                
                courseItem.appendChild(courseName);
                courseItem.appendChild(bubble);
                courseList.appendChild(courseItem);
            }
        });
        
        section.appendChild(title);
        section.appendChild(credits);
        section.appendChild(courseList);
        sidebar.appendChild(section);
    });
}

// Toggle course selection
function toggleCourse(bubble, course, category) {
    const courseId = course.course_id;
    const categoryId = category.category_id;
    const credits = parseInt(course.Credits) || 0;
    console.log('Toggle course credits:', courseId, credits);
    
    if (selectedCourses.has(courseId)) {
        // Deselect course
        selectedCourses.delete(courseId);
        bubble.classList.remove('selected');
        
        // Add credits back to category
        const currentCredits = categoryCredits.get(categoryId) || 0;
        const newCredits = currentCredits + credits;
        console.log('Deselect - New credits:', categoryId, newCredits);
        categoryCredits.set(categoryId, newCredits);
    } else {
        // Select course
        selectedCourses.add(courseId);
        bubble.classList.add('selected');
        
        // Subtract credits from category
        const currentCredits = categoryCredits.get(categoryId) || 0;
        const newCredits = Math.max(0, currentCredits - credits);
        console.log('Select - New credits:', categoryId, newCredits);
        categoryCredits.set(categoryId, newCredits);
    }
    
    // Update credits display
    updateCreditsDisplay(categoryId);
    
    // Update visualization
    if (selectedMajor) {
        visualizeMajor(selectedMajor.major_id);
    }
}

// Update credits display for a category
function updateCreditsDisplay(categoryId) {
    const creditsElement = document.getElementById(`credits-${categoryId}`);
    const remainingCredits = categoryCredits.get(categoryId);
    creditsElement.textContent = `Credits still needed: ${remainingCredits}`;
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
    
    // Filter courses based on selection
    majorCourses = majorCourses.filter(course => selectedCourses.has(course.course_id));
    
    // Get the final list of all course IDs (both major courses and prerequisites)
    const allCourseIds = majorCourses.map(course => course.course_id);
    
    console.log('Major courses with prerequisites:', majorCourses);
    console.log('All course IDs:', allCourseIds);
    
    // Set up the visualization
    const container = document.getElementById('visualization');
    const width = container.clientWidth;
    const height = window.innerHeight - 150; // Increased height to use more vertical space
    const margin = { top: 20, right: 20, bottom: 120, left: 20 }; // Increased bottom margin for legend

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
        .attr('refX', 50) // Increased to move arrow further from node
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 16) // Larger arrows
        .attr('markerHeight', 16)
        .attr('xoverflow', 'visible')
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
        .attr('fill', '#666') // Darker color for better visibility
        .style('stroke', 'none');

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
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
            size: 20,
            courseNumber: 0,
            level: -1 // Root is before level 0
        },
        // Add course nodes
        ...majorCourses.map(course => ({
            id: course.course_id,
            name: course.Name,
            type: 'course',
            subject: course.Subject,
            size: 40,
            courseNumber: parseInt(course.Number) || 0,
            level: prereqLevels.get(course.course_id) || 0
        }))
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
    
    // Create x-scale for horizontal positioning that considers both course number and level
    const xScale = d3.scaleLinear()
        .domain([minCourseNumber, maxCourseNumber])
        .range([margin.left + 100, width - margin.right - 100]);

    // Custom force for x-positioning based on course number and prerequisite level
    const forceX = d3.forceX(d => {
        if (d.type === 'root') {
            return margin.left + 50; // Position root node on the far left
        }
        // Calculate position based on both course number and prerequisite level
        const courseWeight = 0.6; // Weight for course number influence
        const levelWeight = 0.4; // Weight for level influence
        
        const coursePosition = xScale(d.courseNumber);
        const levelPosition = margin.left + 100 + (width - margin.left - margin.right - 200) * (d.level / maxLevel);
        
        return coursePosition * courseWeight + levelPosition * levelWeight;
    }).strength(0.5);

    // Create the force simulation
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-1200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', forceX)
        .force('collision', d3.forceCollide().radius(d => d.size + 40));

    // Add links with arrows
    const link = g.append('g')
        .selectAll('path') // Changed from line to path for curved links
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
        .attr('dy', d => d.size + 25)
        .attr('text-anchor', 'middle')
        .text(d => {
            if (d.type === 'root') return '';
            const parts = d.name.split('-');
            return parts.length > 1 ? parts[1].trim() : d.name;
        })
        .style('fill', '#000')
        .style('font-size', '20px')
        .style('pointer-events', 'none')
        .style('font-weight', 'bold')
        .each(function(d) {
            // Store the text width and height for collision detection
            const bbox = this.getBBox();
            d.textWidth = bbox.width;
            d.textHeight = bbox.height;
        });

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
            const curve = 30 * (index - (parallelLinks.length - 1) / 2);
            
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
                Q${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2} 
                ${d.target.x},${d.target.y}`;
    }

    // Update simulation tick function
    simulation.on('tick', () => {
        // Update node positions with bounds checking
        node.attr('transform', d => {
            const r = d.size;
            const textHeight = d.textHeight || 0;
            const textWidth = d.textWidth || 0;
            
            d.x = Math.max(r + textWidth/2, Math.min(width - r - textWidth/2, d.x));
            d.y = Math.max(r + textHeight, Math.min(height - r - textHeight, d.y));
            
            return `translate(${d.x},${d.y})`;
        });

        // Update link paths
        link.attr('d', linkArc);
    });

    // Add hover effect for links
    link.on('mouseover', function() {
        d3.select(this)
            .attr('stroke-width', 4)
            .attr('stroke-opacity', 1);
    })
    .on('mouseout', function() {
        d3.select(this)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
    });

    // Create legend
    const uniqueSubjects = [...new Set(nodes.map(d => d.subject))];
    console.log('Unique subjects:', uniqueSubjects);
    
    // Update legend position to be at the bottom
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${margin.left},${height - margin.bottom})`);

    // Make legend more compact if many subjects
    const legendItemWidth = 120; // Reduced width for each legend item
    const legendItemsPerRow = Math.floor((width - margin.left - margin.right) / legendItemWidth);

    const legendItem = legend.selectAll('.legend-item')
        .data(uniqueSubjects)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => {
            const row = Math.floor(i / legendItemsPerRow);
            const col = i % legendItemsPerRow;
            return `translate(${col * legendItemWidth}, ${row * 20})`;
        });

    legendItem.append('circle')
        .attr('r', 6)
        .attr('fill', d => {
            console.log('Legend color for subject:', d, 'Color:', getSubjectColor(d));
            return getSubjectColor(d);
        });

    legendItem.append('text')
        .attr('x', 15)
        .attr('y', 4)
        .text(d => d)
        .style('font-size', '12px')
        .style('fill', '#333');
}

// Drag behavior
function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', loadData); 