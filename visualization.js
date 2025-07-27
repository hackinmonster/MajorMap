// Global variables
let courses = [];
let prerequisites = [];
let simulation = null;
let svg = null;

// Load data from CSV files
async function loadData() {
    try {
        console.log('Starting to load data...');
        
        console.log('Loading prerequisites.csv...');
        const prerequisitesData = await d3.csv('data/prerequisites.csv', d => ({
            course_id: d['Course ID'],
            prerequisite_id: d['Required Course']
        }));
        console.log('Prerequisites loaded count:', prerequisitesData.length);

        console.log('Loading courses.csv...');
        const allCoursesData = await d3.csv('data/courses.csv', d => {
            const course_id = `${d.Subject} ${d.Number}`;
            
            // Try to parse credits, checking different possible column names
            let credits = null;
            if (d.Credits !== undefined) credits = parseInt(d.Credits);
            if (credits === null && d.credits !== undefined) credits = parseInt(d.credits);
            if (credits === null && d.Credit !== undefined) credits = parseInt(d.Credit);
            if (credits === null && d.credit !== undefined) credits = parseInt(d.credit);
            
            return {
                course_id: course_id,
                Name: d.Name,
                Subject: d.Subject,
                Number: d.Number,
                Credits: credits || 3, // Default to 3 credits if not specified
                Description: d.Description
            };
        });
        console.log('Courses loaded count:', allCoursesData.length);

        courses = allCoursesData;
        prerequisites = prerequisitesData;

        console.log('Data loading complete');
        
        // Show loading message
        d3.select('#visualization')
            .append('div')
            .attr('class', 'alert alert-info text-center')
            .html('<h3>Loading Visualization</h3><p>Please wait while the course network is being generated...</p>');
            
        // Use setTimeout to allow the browser to render the loading message
        setTimeout(() => {
            visualizeCourses();
        }, 100);
    } catch (error) {
        console.error('Error loading data:', error);
        // Display error message on the visualization div
        d3.select('#visualization')
            .append('div')
            .attr('class', 'alert alert-danger')
            .html(`<h3>Error Loading Data</h3><p>${error.message}</p>`);
    }
}

// Function to get subject colors
function getSubjectColor(subject) {
    const colorMap = {
        'CS': '#4285F4', // Blue
        'MATH': '#EA4335', // Red
        'ENGL': '#FBBC05', // Yellow
        'PHYS': '#34A853', // Green
        'CHEM': '#8F43EE', // Purple
        'BIO': '#0F9D58', // Dark Green
        'HIST': '#F4B400', // Amber
        'ECON': '#DB4437', // Red-Orange
        'PSYC': '#4285F4', // Blue
        'SOC': '#0F9D58', // Green
    };
    
    // If the subject has a defined color, use it; otherwise, generate one based on the subject name
    if (colorMap[subject]) {
        return colorMap[subject];
    } else {
        // Generate a color based on the string (consistent hash-based approach)
        let hash = 0;
        for (let i = 0; i < subject.length; i++) {
            hash = subject.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to RGB value in the range of 30-220 to avoid too dark or too light colors
        const r = ((hash & 0xFF) % 190) + 30;
        const g = (((hash >> 8) & 0xFF) % 190) + 30;
        const b = (((hash >> 16) & 0xFF) % 190) + 30;
        
        return `rgb(${r}, ${g}, ${b})`;
    }
}

function visualizeCourses() {
    console.log('Starting visualization...');
    
    // Clear previous visualization
    d3.select('#visualization').selectAll('*').remove();

    if (!courses.length || !prerequisites.length) {
        console.error('No courses or prerequisites data available');
        d3.select('#visualization')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html('<h3>No Data Available</h3><p>Could not load course or prerequisite data.</p>');
        return;
    }

    // Count connections for each course to find most connected subjects
    const subjectConnections = new Map();
    
    prerequisites.forEach(prereq => {
        // Find courses for this prerequisite relationship
        const course = courses.find(c => c.course_id === prereq.course_id);
        const prereqCourse = courses.find(c => c.course_id === prereq.prerequisite_id);
        
        if (course && prereqCourse) {
            // Increment count for both subjects
            if (!subjectConnections.has(course.Subject)) {
                subjectConnections.set(course.Subject, 0);
            }
            subjectConnections.set(course.Subject, subjectConnections.get(course.Subject) + 1);
            
            if (!subjectConnections.has(prereqCourse.Subject)) {
                subjectConnections.set(prereqCourse.Subject, 0);
            }
            subjectConnections.set(prereqCourse.Subject, subjectConnections.get(prereqCourse.Subject) + 1);
        }
    });
    
    // Sort subjects by connection count
    const sortedSubjects = Array.from(subjectConnections.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Take top 5 most connected subjects
        .map(entry => entry[0]);
    
    console.log('Selected subjects:', sortedSubjects);
    
    // Filter courses to only those in the top subjects
    let filteredCourses = courses.filter(course => sortedSubjects.includes(course.Subject));
    
    // Further limit courses to those with connections
    const courseConnections = new Map();
    
    prerequisites.forEach(prereq => {
        // Count for course that has prerequisites
        if (!courseConnections.has(prereq.course_id)) {
            courseConnections.set(prereq.course_id, 0);
        }
        courseConnections.set(prereq.course_id, courseConnections.get(prereq.course_id) + 1);
        
        // Count for course that is a prerequisite
        if (!courseConnections.has(prereq.prerequisite_id)) {
            courseConnections.set(prereq.prerequisite_id, 0);
        }
        courseConnections.set(prereq.prerequisite_id, courseConnections.get(prereq.prerequisite_id) + 1);
    });
    
    // Convert to array and sort by connection count
    const sortedCourses = Array.from(courseConnections.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100) // Take top 100 most connected courses
        .map(entry => entry[0]);
    
    // Filter to courses that are both in top subjects and top connections
    let displayCourses = filteredCourses.filter(course => sortedCourses.includes(course.course_id));
    
    // Ensure we don't have too many courses (limit to 100 maximum)
    if (displayCourses.length > 100) {
        displayCourses = displayCourses.slice(0, 100);
    }
    
    // Filter prerequisites to only those that connect our display courses
    let displayPrereqs = prerequisites.filter(prereq => 
        displayCourses.some(c => c.course_id === prereq.course_id) && 
        displayCourses.some(c => c.course_id === prereq.prerequisite_id)
    );
    
    console.log('Courses to display count:', displayCourses.length);
    console.log('Prerequisites to display count:', displayPrereqs.length);
    
    if (displayCourses.length === 0 || displayPrereqs.length === 0) {
        console.error('No connected courses found to display');
        d3.select('#visualization')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html('<h3>No Connected Courses</h3><p>Could not find connected courses to display.</p>');
        return;
    }
    
    // Get the final list of all course IDs
    const allCourseIds = displayCourses.map(course => course.course_id);
    
    // Set up the visualization
    const container = document.getElementById('visualization');
    const width = container.clientWidth || window.innerWidth - 40;
    const height = container.clientHeight || window.innerHeight - 40;
    const margin = { top: 40, right: 20, bottom: 120, left: 20 };

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
        .attr('refX', 20) // Distance from node
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8) 
        .attr('markerHeight', 8)
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

    // Create nodes for each course
    const nodes = displayCourses.map(course => ({
        id: course.course_id,
        name: course.Name,
        subject: course.Subject,
        size: 20, // Even smaller nodes to fit more
        courseNumber: parseInt(course.Number) || 0,
        credits: course.Credits || 3,
        description: course.Description || ''
    }));

    // Create links from prerequisites
    const links = displayPrereqs.map(p => ({
        source: p.prerequisite_id,
        target: p.course_id
    }));

    // Create the force simulation
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(40))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.size + 5));

    // Function to create curved links
    function linkArc(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        // Create a gentle curve for all links
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    }

    // Add links with arrows
    const link = g.append('g')
        .selectAll('path')
        .data(links)
        .enter()
        .append('path')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1)
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

    // Add circles for nodes
    node.append('circle')
        .attr('r', d => d.size / 2)
        .attr('fill', d => getSubjectColor(d.subject))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

    // Add course ID text
    node.append('text')
        .attr('class', 'course-id')
        .attr('text-anchor', 'middle')
        .attr('dy', '.3em')
        .attr('font-size', '7px')
        .attr('fill', '#fff')
        .text(d => d.id);

    // Add tooltips for course details
    const tooltip = d3.select('#tooltip');
    
    node.on('mouseover', function(event, d) {
        // Find the course data
        const course = courses.find(c => c.course_id === d.id);
        if (course) {
            // Find prerequisites
            const coursePrereqs = prerequisites
                .filter(p => p.course_id === d.id)
                .map(p => p.prerequisite_id);
            
            // Find courses that this course is a prerequisite for
            const isPrereqFor = prerequisites
                .filter(p => p.prerequisite_id === d.id)
                .map(p => p.course_id);
            
            tooltip.style('opacity', 1);
            tooltip.html(`
                <strong>${d.id}</strong><br>
                ${d.name}<br>
                Credits: ${course.Credits || 'N/A'}<br>
                <br>
                <strong>Prerequisites:</strong> ${coursePrereqs.length > 0 ? coursePrereqs.join(', ') : 'None'}<br>
                <strong>Required for:</strong> ${isPrereqFor.length > 0 ? isPrereqFor.join(', ') : 'None'}<br>
                <br>
                <em>${d.description ? (d.description.length > 150 ? d.description.substring(0, 150) + '...' : d.description) : 'No description available'}</em>
            `);
            
            // Position the tooltip near the node
            tooltip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 28) + 'px');
            
            // Highlight related nodes
            node.selectAll('circle')
                .style('opacity', 0.3);
            
            link.style('opacity', 0.1);
            
            // Highlight this node and its direct connections
            d3.select(this).select('circle')
                .style('opacity', 1);
            
            // Highlight prerequisites
            node.filter(n => coursePrereqs.includes(n.id))
                .select('circle')
                .style('opacity', 1)
                .style('stroke', '#ff6600')
                .style('stroke-width', 1.5);
            
            // Highlight courses this is a prerequisite for
            node.filter(n => isPrereqFor.includes(n.id))
                .select('circle')
                .style('opacity', 1)
                .style('stroke', '#0099ff')
                .style('stroke-width', 1.5);
            
            // Highlight relevant links
            link.filter(l => 
                (l.source.id === d.id) || 
                (l.target.id === d.id)
            )
            .style('opacity', 0.8)
            .style('stroke-width', 1.5);
        }
    })
    .on('mouseout', function() {
        tooltip.style('opacity', 0);
        
        // Reset all nodes and links
        node.selectAll('circle')
            .style('opacity', 1)
            .style('stroke', '#fff')
            .style('stroke-width', 1);
        
        link.style('opacity', 0.4)
            .style('stroke-width', 1);
    });

    // Update positions on each simulation tick
    simulation.on('tick', () => {
        link.attr('d', linkArc);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Add title to explain the visualization
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(`Course Prerequisite Network: Top ${displayCourses.length} Most Connected Courses`);
        
    // Add subtitle with instructions
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Hover over nodes to see details and drag to reposition | Use mouse wheel to zoom');

    // Create a legend for subject colors
    const subjects = [...new Set(displayCourses.map(course => course.Subject))];
    
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${margin.left + 20},${height - margin.bottom + 30})`);
    
    const legendRectSize = 12;
    const legendSpacing = 4;
    const legendItemWidth = 80;
    const legendItemsPerRow = Math.floor((width - margin.left - margin.right) / legendItemWidth);
    
    subjects.forEach((subject, i) => {
        const row = Math.floor(i / legendItemsPerRow);
        const col = i % legendItemsPerRow;
        
        const legendItem = legend.append('g')
            .attr('transform', `translate(${col * legendItemWidth}, ${row * (legendRectSize + legendSpacing)})`);
        
        legendItem.append('rect')
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .style('fill', getSubjectColor(subject))
            .style('stroke', '#fff');
        
        legendItem.append('text')
            .attr('x', legendRectSize + legendSpacing + 2)
            .attr('y', legendRectSize - legendSpacing)
            .text(subject)
            .style('font-size', '10px');
    });
}

// Drag functionality for nodes
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
document.addEventListener('DOMContentLoaded', () => {
    loadData();
}); 