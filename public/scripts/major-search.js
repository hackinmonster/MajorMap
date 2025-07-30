// Major Search Module - Search and select academic majors

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
    
    // Initialize the sidebar first (this will auto-select non-choice courses)
    initializeSidebar(major.major_id);
    
    // Small delay to ensure sidebar is initialized before visualization
    setTimeout(() => {
        visualizeMajor(major.major_id);
    }, 200);
} 