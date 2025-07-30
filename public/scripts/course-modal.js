// Course Modal Module - Display detailed course information

// Show detailed course information in a modal
function showCourseInformation(courseId) {
    // Find the course data
    const course = courses.find(c => c.course_id === courseId);
    if (!course) return;
    
    // Get prerequisites and dependent courses
    const coursePrereqs = prerequisites.filter(p => p.course_id === courseId);
    const dependentCourses = prerequisites.filter(p => p.prerequisite_id === courseId);
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'course-modal-overlay';
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeCourseModal();
        }
    };
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'course-modal-content';
    
    // Build prerequisites text
    let prerequisitesText = 'None';
    if (coursePrereqs.length > 0) {
        const prereqNames = coursePrereqs.map(p => {
            const prereqCourse = courses.find(c => c.course_id === p.prerequisite_id);
            return prereqCourse ? prereqCourse.course_id : p.prerequisite_id;
        });
        prerequisitesText = prereqNames.join(', ');
    }
    
    // Build dependent courses text
    let dependentsText = 'None';
    if (dependentCourses.length > 0) {
        const depNames = dependentCourses.map(d => {
            const depCourse = courses.find(c => c.course_id === d.course_id);
            return depCourse ? depCourse.course_id : d.course_id;
        });
        dependentsText = depNames.join(', ');
    }
    
    // Get course description
    const description = course.Description || 'No description available.';
    
    modalContent.innerHTML = `
        <div class="course-modal-header">
            <h2>${course.course_id}</h2>
            <button class="course-modal-close" onclick="closeCourseModal()">&times;</button>
        </div>
        <div class="course-modal-body">
            <h3>${course.Name}</h3>
            
            <div class="course-info-grid">
                <div class="course-info-item">
                    <strong>Credits:</strong>
                    ${getCourseCredits(course.course_id, course.Credits)}
                </div>
                <div class="course-info-item">
                    <strong>Department:</strong>
                    ${course.Subject}
                </div>
            </div>
            
            <div class="course-prereq-section">
                <h4>Prerequisites</h4>
                <p>${prerequisitesText}</p>
            </div>
            
            <div class="course-dependent-section">
                <h4>Required For</h4>
                <p>${dependentsText}</p>
            </div>
            
            <div class="course-description-section">
                <h4>Description</h4>
                <p>${description}</p>
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
        }, 300);
    }
} 