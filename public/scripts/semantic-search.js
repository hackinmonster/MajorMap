// Semantic Search Module - AI-powered course recommendations

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
                Semantic Course Search
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
        // Get semantic search results from API
        console.log('Calling semantic search API...');
        const rankedCourses = await getSemanticSearchResults(input);
        console.log('Received courses:', rankedCourses);
        
        // Display results
        console.log('Displaying results...');
        displaySemanticResults(rankedCourses, input);
        
    } catch (error) {
        console.error('Semantic search error:', error);
        
        // Fallback to local analysis on error
        try {
            const keywords = await simulateOpenAIAnalysis(input);
            const fallbackResults = performCourseSemanticSearch(keywords, input);
            displaySemanticResults(fallbackResults, input);
        } catch (fallbackError) {
            resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> Unable to process your request. ${error.message || 'Please try again later.'}
                </div>
            `;
        }
    } finally {
        // Re-enable button
        searchButton.disabled = false;
        searchButton.innerHTML = '<i class="fas fa-search"></i> Find Relevant Courses';
    }
}

// Get semantic search results from API
async function getSemanticSearchResults(userInput) {
    try {
        console.log('Making semantic search API call for input:', userInput);
        
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({ 
                query: userInput,
                timestamp: Date.now()
            })
        });
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to get course recommendations');
        }
        
        const data = await response.json();
        console.log('API response data:', data);
        console.log('Search method used:', data.method);
        
        return data.results || [];
    } catch (error) {
        console.error('Semantic search API failed, falling back to local analysis:', error);
        // Fallback to local analysis if API fails
        const keywords = await simulateOpenAIAnalysis(userInput);
        return performCourseSemanticSearch(keywords, userInput);
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
function displaySemanticResults(rankedCourses, queryOrKeywords) {
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
    
    // Check if we have keywords (array) or just a query string
    let headerInfo = '';
    if (Array.isArray(queryOrKeywords)) {
        // Keyword-based fallback
        const keywordsList = queryOrKeywords.map(k => `<span class="badge bg-primary me-1">${k}</span>`).join('');
        headerInfo = `<small class="text-muted">Based on keywords: ${keywordsList}</small>`;
    } else {
        // Semantic search
        const topSimilarity = rankedCourses[0]?.relevancePercentage || 0;
        headerInfo = `<small class="text-muted">Semantic similarity search • Top match: ${topSimilarity}%</small>`;
    }
    
    const resultsHTML = `
        <div class="semantic-results">
            <h3>Recommended Courses</h3>
            <div class="mb-3">
                ${headerInfo}
            </div>
            ${rankedCourses.map(item => createCourseResultHTML(item)).join('')}
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
}

// Create HTML for a single course result
function createCourseResultHTML(courseItem) {
    const { course, score, matchedKeywords, relevancePercentage, similarity } = courseItem;
    const truncatedDescription = course.Description ? 
        (course.Description.length > 200 ? course.Description.substring(0, 200) + '...' : course.Description) :
        'No description available.';
    
    // Handle both semantic search results and keyword-based results
    const matchInfo = matchedKeywords && matchedKeywords.length > 0 ? 
        matchedKeywords.map(k => `<span class="badge bg-success me-1">${k}</span>`).join('') : '';
    
    // Use similarity score if available (semantic search), otherwise use relevancePercentage
    const displayPercentage = similarity ? Math.round(similarity * 100) : relevancePercentage;
    
    return `
        <div class="course-result" onclick="showCourseInformation('${course.course_id}')">
            <div class="course-result-header">
                <div class="course-result-id">${course.course_id}</div>
                <div class="course-result-relevance">${displayPercentage}% match</div>
            </div>
            <div class="course-result-name">${course.Name}</div>
            <div class="course-result-description">${truncatedDescription}</div>
            ${matchInfo ? `
                <div class="mt-2">
                    <small class="text-muted">Matched: ${matchInfo}</small>
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