// Timeline initialization and functionality

// Initialize the semester timeline
function initializeTimeline() {
    const timeline = document.getElementById('timeline');
    const currentYear = new Date().getFullYear();
    
    // Create 8 semesters (4 years) starting from the nearest Fall semester
    const currentMonth = new Date().getMonth(); // 0-11
    let startYear = currentYear;
    let startSemester = currentMonth >= 7 ? 'Fall' : 'Spring'; // If month is August or later, start with Fall
    
    if (startSemester === 'Spring') {
        startYear++; // For spring, we'll use the next year
    }
    
    // Generate semesters
    for (let i = 0; i < 8; i++) {
        const year = startYear + Math.floor(i / 2);
        const semester = (i % 2 === 0) ? 'Fall' : 'Spring';
        
        // Skip the initial Spring if we're starting with Fall
        if (i === 0 && startSemester === 'Fall') {
            createSemesterBox(timeline, 'Fall', year);
        } else if (i === 0 && startSemester === 'Spring') {
            createSemesterBox(timeline, 'Spring', year);
        } else {
            if (startSemester === 'Fall') {
                // Fall start, so we alternate Fall/Spring
                createSemesterBox(timeline, (i % 2 === 0) ? 'Fall' : 'Spring', year);
            } else {
                // Spring start, so we alternate Spring/Fall
                createSemesterBox(timeline, (i % 2 === 0) ? 'Spring' : 'Fall', year);
            }
        }
    }
}

function createSemesterBox(container, semester, year) {
    const box = document.createElement('div');
    box.className = 'semester-box';
    box.id = `semester-${semester.toLowerCase()}-${year}`;
    
    const header = document.createElement('div');
    header.className = 'semester-header';
    header.textContent = `${semester} ${year}`;
    
    const content = document.createElement('div');
    content.className = 'semester-content';
    
    // Add a credits counter
    const credits = document.createElement('div');
    credits.className = 'timeline-credits';
    credits.textContent = '0 credits';
    
    box.appendChild(header);
    box.appendChild(content);
    box.appendChild(credits);
    container.appendChild(box);
}

// Initialize timeline toggle functionality
function initializeTimelineToggle() {
    const toggleButton = document.getElementById('timelineToggle');
    const timelineContainer = document.getElementById('timeline-container');
    const showBar = document.getElementById('timelineShowBar');
    let isHidden = false;

    function hideTimeline() {
        timelineContainer.classList.add('hidden');
        showBar.classList.add('visible');
        toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
        toggleButton.title = 'Show Timeline';
    }

    function showTimeline() {
        timelineContainer.classList.remove('hidden');
        showBar.classList.remove('visible');
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
        toggleButton.title = 'Hide Timeline';
    }

    toggleButton.addEventListener('click', () => {
        isHidden = !isHidden;
        if (isHidden) {
            hideTimeline();
        } else {
            showTimeline();
        }
    });

    showBar.addEventListener('click', () => {
        isHidden = false;
        showTimeline();
    });
}

// Initialize mouse wheel scrolling for timeline
function initializeTimelineScrolling() {
    const timelineContainer = document.getElementById('timeline-container');
    const timeline = document.getElementById('timeline');

    function handleWheelScroll(e) {
        // Check if we're over the timeline area
        const rect = timelineContainer.getBoundingClientRect();
        const isOverTimeline = e.clientX >= rect.left && e.clientX <= rect.right && 
                             e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isOverTimeline) {
            e.preventDefault();
            e.stopPropagation();
            
            // Scroll horizontally
            const scrollAmount = e.deltaY * 3; // Increase multiplier for faster scrolling
            timeline.scrollLeft += scrollAmount;
        }
    }

    // Add event listener to document to catch all wheel events
    document.addEventListener('wheel', handleWheelScroll, { passive: false });
    
    // Also add directly to timeline elements
    timelineContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        timeline.scrollLeft += e.deltaY * 3;
    }, { passive: false });
    
    timeline.addEventListener('wheel', (e) => {
        e.preventDefault();
        timeline.scrollLeft += e.deltaY * 3;
    }, { passive: false });
}

// Initialize timeline after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeTimeline();
    initializeTimelineToggle();
    initializeTimelineScrolling();
}); 