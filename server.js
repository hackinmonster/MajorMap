const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { ChromaClient } = require('chromadb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/data', express.static('data'));

// Course data cache
let courses = [];

// ChromaDB setup
const chromaClient = new ChromaClient();
let courseCollection = null;

// Load course data on startup
async function loadCourseData() {
    try {
        const coursesData = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(path.join(__dirname, 'data', 'courses.csv'))
                .pipe(csv())
                .on('data', (row) => {
                    coursesData.push(row);
                })
                .on('end', () => {
                    courses = coursesData;
                    console.log(`Loaded ${courses.length} courses`);
                    resolve();
                })
                .on('error', reject);
        });
    } catch (error) {
        console.error('Error loading course data:', error);
    }
}

// Initialize ChromaDB connection
async function initializeChromaDB() {
    try {
        courseCollection = await chromaClient.getCollection({
            name: "course_embeddings"
        });
        console.log('✅ Connected to ChromaDB course_embeddings collection');
        
        const count = await courseCollection.count();
        console.log(`📊 ChromaDB contains ${count} course embeddings`);
        
        if (count === 0) {
            console.log('⚠️  ChromaDB collection is empty! Run: node scripts/setup-embeddings.js');
        }
    } catch (error) {
        console.error('❌ ChromaDB connection failed:', error.message);
        console.log('💡 To setup ChromaDB, run: node scripts/setup-embeddings.js');
        courseCollection = null;
    }
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'templates', 'index.html'));
});

// Debug endpoint to check ITSC courses
app.get('/api/debug-itsc-courses', async (req, res) => {
    try {
        const itscCourses = courses.filter(course => course.Subject === 'ITSC');
        const sampleCourses = itscCourses.slice(0, 10).map(course => ({
            course_id: `${course.Subject} ${course.Number}`,
            name: course.Name,
            description: course.Description?.substring(0, 100) + '...',
            subject: course.Subject
        }));
        
        res.json({
            total_courses: courses.length,
            itsc_courses_count: itscCourses.length,
            sample_itsc_courses: sampleCourses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint for subject detection
app.get('/api/debug-subjects/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const queryLower = query.toLowerCase();
        
        const subjectHints = {
            'philosophy': ['PHIL', 'RELS', 'AFRS'],
            'psychology': ['PSYC', 'AFRS', 'SOCY'],
            'biology': ['BIOL', 'BINF', 'CHEM'],
            'zoology': ['BIOL'],
            'physics': ['PHYS', 'MATH'],
            'chemistry': ['CHEM', 'BIOL'],
            'english': ['ENGL', 'WRTG'],
            'history': ['HIST', 'AFRS', 'AMST'],
            'economics': ['ECON', 'FINN'],
            'business': ['BUSN', 'ACCT', 'FINN', 'MGMT'],
        };
        
        let relevantSubjects = [];
        let matchedTopic = null;
        for (const [topic, subjects] of Object.entries(subjectHints)) {
            if (queryLower.includes(topic)) {
                relevantSubjects = [...relevantSubjects, ...subjects];
                matchedTopic = topic;
                break;
            }
        }
        
        const priorityCourses = courses.filter(course => relevantSubjects.includes(course.Subject));
        const samplePriority = priorityCourses.slice(0, 5).map(c => `${c.Subject} ${c.Number} - ${c.Name}`);
        
        res.json({
            query,
            queryLower,
            matchedTopic,
            relevantSubjects,
            priorityCoursesCount: priorityCourses.length,
            samplePriorityCourses: samplePriority
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to test course embeddings
app.get('/api/test-course-embeddings', async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.json({ error: 'OpenAI API key not configured' });
        }

        console.log('Testing course embeddings...');
        
        // Test with 3 very different course descriptions
        const course1Text = "Introduction to basic computer literacy, computational thinking and problem-solving using a high level programming language";
        const course2Text = "A study of discreet mathematical concepts. Introduction to propositional calculus, predicate calculus, algorithms, logic functions";
        const course3Text = "Advanced Chinese Grammar and Conversation designed for students who have successfully completed Chinese Grammar and Conversation";
        
        console.log('Generating embeddings for 3 different courses...');
        const emb1 = await generateEmbedding(course1Text);
        const emb2 = await generateEmbedding(course2Text);
        const emb3 = await generateEmbedding(course3Text);
        
        const sim12 = cosineSimilarity(emb1, emb2);
        const sim13 = cosineSimilarity(emb1, emb3);
        const sim23 = cosineSimilarity(emb2, emb3);
        
        res.json({
            course1: { text: course1Text.substring(0, 80), embedding_sample: emb1.slice(0, 3) },
            course2: { text: course2Text.substring(0, 80), embedding_sample: emb2.slice(0, 3) },
            course3: { text: course3Text.substring(0, 80), embedding_sample: emb3.slice(0, 3) },
            similarities: {
                comp_math: sim12,
                comp_chinese: sim13,
                math_chinese: sim23
            },
            same_embeddings: JSON.stringify(emb1.slice(0, 5)) === JSON.stringify(emb2.slice(0, 5))
        });
    } catch (error) {
        console.error('Test course embeddings error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate embeddings using OpenAI
async function generateEmbedding(text) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const axios = require('axios');
        const response = await axios.post('https://api.openai.com/v1/embeddings', {
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float"
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const embedding = response.data.data[0].embedding;
        return embedding;
    } catch (error) {
        console.error('Error generating embedding:', error.response?.data || error.message);
        throw error;
    }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

// Note: Course embeddings are now handled by ChromaDB
// Run 'node scripts/setup-embeddings.js' to populate the vector database

// Fast semantic search using ChromaDB
app.post('/api/semantic-search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Check if ChromaDB is available
        if (!courseCollection) {
            console.log('ChromaDB not available, falling back to keyword search');
            const keywords = await simulateOpenAIAnalysis(query);
            return res.json({ 
                results: performKeywordSearch(keywords, query),
                method: 'keyword-fallback',
                message: 'ChromaDB not available. Run: node scripts/setup-embeddings.js'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            const keywords = await simulateOpenAIAnalysis(query);
            return res.json({ 
                results: performKeywordSearch(keywords, query),
                method: 'keyword'
            });
        }

        console.log(`\n🔍 CHROMADB SEMANTIC SEARCH: "${query}"`);
        
        // Generate embedding for query only (much faster!)
        const queryEmbedding = await generateEmbedding(query);
        console.log(`✅ Generated query embedding (${queryEmbedding.length}D)`);
        
        // Query ChromaDB for similar courses
        const startTime = Date.now();
        const chromaResults = await courseCollection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: 20,
            include: ['metadatas', 'documents', 'distances']
        });
        const queryTime = Date.now() - startTime;
        
        // Convert ChromaDB results to our format
        const results = [];
        if (chromaResults.ids && chromaResults.ids[0]) {
            for (let i = 0; i < chromaResults.ids[0].length; i++) {
                const courseId = chromaResults.ids[0][i];
                const metadata = chromaResults.metadatas[0][i];
                const distance = chromaResults.distances[0][i];
                
                // Convert distance to similarity (ChromaDB returns cosine distance)
                const similarity = 1 - distance;
                
                // Convert ChromaDB format back to our course format
                const course = {
                    Name: metadata.name,
                    Subject: metadata.subject,
                    Number: metadata.number,
                    Description: metadata.description,
                    Credits: metadata.credits,
                    Restrictions: metadata.restrictions,
                    course_id: courseId.replace('_', ' ')
                };
                
                results.push({
                    course,
                    similarity,
                    relevancePercentage: Math.round(similarity * 100)
                });
                
                // Log high-quality results
                if (similarity > 0.3) {
                    console.log(`✨ ${course.course_id}: ${(similarity * 100).toFixed(1)}% - ${metadata.name.substring(0, 50)}`);
                }
            }
        }
        
        console.log(`⚡ ChromaDB query completed in ${queryTime}ms`);
        console.log(`🎯 Found ${results.length} results. Top similarity: ${results.length > 0 ? (results[0].similarity * 100).toFixed(1) : 0}%`);
        
        const debugInfo = {
            chromadb_query_time_ms: queryTime,
            total_results: results.length,
            top_similarity: results.length > 0 ? results[0].similarity.toFixed(3) : '0',
            method: 'chromadb'
        };
        
        res.json({ 
            results: results.slice(0, 15), // Return top 15
            method: 'semantic-chromadb',
            query: query,
            debug: debugInfo
        });
        
    } catch (error) {
        console.error('ChromaDB semantic search error:', error);
        
        // Fallback to keyword search
        try {
            const keywords = await simulateOpenAIAnalysis(req.body.query);
            res.json({ 
                results: performKeywordSearch(keywords, req.body.query),
                method: 'keyword-fallback',
                error: error.message
            });
        } catch (fallbackError) {
            res.status(500).json({ error: 'Failed to process search request' });
        }
    }
});

// Keyword-based search fallback
function performKeywordSearch(keywords, originalQuery) {
    const scoredCourses = courses.map(course => {
        const searchText = `${course.Name || ''} ${course.Description || ''}`.toLowerCase();
        const courseId = `${course.Subject} ${course.Number}`;
        
        let score = 0;
        let matchedKeywords = [];
        
        // Score based on keyword matches
        keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            
            // Higher score for exact matches in course name
            if ((course.Name || '').toLowerCase().includes(keywordLower)) {
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
        
        // Add course ID for frontend compatibility
        const enhancedCourse = {
            ...course,
            course_id: courseId
        };
        
        return {
            course: enhancedCourse,
            score,
            similarity: score / 100, // Convert to similarity-like score
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

async function getOpenAIKeywords(userQuery) {
    // If OpenAI API key is not provided, fall back to local analysis
    if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI API key not found, using local analysis');
        return await simulateOpenAIAnalysis(userQuery);
    }

    try {
        const axios = require('axios');
        console.log('Attempting OpenAI API call for query:', userQuery);

        const systemPrompt = `You are a course recommendation assistant for a university. Given a student's career interest or learning goal, generate a list of 6-8 relevant academic keywords that would help find appropriate courses.

The keywords should be:
- Academic subjects and concepts taught in university courses
- Skills and knowledge areas relevant to the career goal
- Technical terms commonly used in course names and descriptions
- Broad enough to match various course offerings

Return only a JSON array of keyword strings, no other text.

Examples:
Input: "I want to become a data scientist"
Output: ["statistics", "machine learning", "data analysis", "programming", "mathematics", "databases", "python", "algorithms"]

Input: "I'm interested in cybersecurity"
Output: ["security", "network security", "cryptography", "computer systems", "information security", "programming", "operating systems", "risk management"]`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery }
            ],
            max_tokens: 200,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('OpenAI API response received successfully');
        const content = response.data.choices[0].message.content.trim();
        console.log('OpenAI response content:', content);
        
        try {
            const keywords = JSON.parse(content);
            if (Array.isArray(keywords)) {
                console.log('Successfully parsed keywords:', keywords);
                return keywords.slice(0, 8); // Limit to 8 keywords
            }
        } catch (parseError) {
            console.error('Failed to parse OpenAI response as JSON:', content);
        }
        
        // Fallback if parsing fails
        console.log('Falling back to local analysis due to parse error');
        return await simulateOpenAIAnalysis(userQuery);
        
    } catch (error) {
        if (error.response) {
            console.error('OpenAI API error response:', error.response.status, error.response.data);
            if (error.response.status === 401) {
                console.error('OpenAI API authentication failed. Please check your API key.');
            }
        } else {
            console.error('OpenAI API error:', error.message);
        }
        
        // Fallback to local analysis
        console.log('Falling back to local analysis due to API error');
        return await simulateOpenAIAnalysis(userQuery);
    }
}

// Fallback function for local keyword analysis
async function simulateOpenAIAnalysis(userInput) {
    const input = userInput.toLowerCase();
    
    // Career/interest to keywords mapping
    const keywordMappings = {
        'data scien': ['statistics', 'machine learning', 'data analysis', 'python', 'programming', 'database', 'mathematics', 'linear algebra'],
        'cybersecurity': ['security', 'network security', 'cryptography', 'computer systems', 'information security', 'programming', 'operating systems'],
        'software engineer': ['programming', 'software development', 'algorithms', 'data structures', 'computer science', 'object oriented', 'software design'],
        'web develop': ['web programming', 'javascript', 'html', 'css', 'database', 'programming', 'software engineering', 'user interface'],
        'artificial intelligence': ['machine learning', 'neural networks', 'algorithms', 'mathematics', 'programming', 'statistics', 'computer science'],
        'machine learning': ['statistics', 'mathematics', 'algorithms', 'programming', 'linear algebra', 'calculus', 'data analysis'],
        'game develop': ['programming', 'computer graphics', 'software engineering', 'mathematics', 'algorithms', 'computer science'],
        'mobile app': ['programming', 'software development', 'user interface', 'mobile computing', 'app development'],
        'network': ['networking', 'computer networks', 'systems administration', 'security', 'telecommunications'],
        'database': ['database design', 'data management', 'sql', 'data structures', 'information systems'],
        'business': ['business', 'management', 'economics', 'finance', 'marketing', 'accounting'],
        'math': ['mathematics', 'calculus', 'linear algebra', 'statistics', 'discrete mathematics', 'probability'],
        'engineer': ['engineering', 'mathematics', 'physics', 'problem solving', 'design', 'systems']
    };
    
    let keywords = [];
    
    // Find matching keywords based on input
    for (const [key, keywordList] of Object.entries(keywordMappings)) {
        if (input.includes(key)) {
            keywords = [...keywords, ...keywordList];
            break;
        }
    }
    
    // If no specific match, extract general keywords
    if (keywords.length === 0) {
        if (input.includes('program') || input.includes('code') || input.includes('computer')) {
            keywords = ['programming', 'computer science', 'software development', 'algorithms', 'problem solving'];
        } else if (input.includes('business') || input.includes('manage')) {
            keywords = ['business', 'management', 'economics', 'communication', 'leadership'];
        } else {
            keywords = ['technology', 'problem solving', 'analysis', 'communication', 'mathematics'];
        }
    }
    
    // Remove duplicates and limit to top 8 keywords
    keywords = [...new Set(keywords)].slice(0, 8);
    
    return keywords;
}

// Start server and load data
async function startServer() {
    await loadCourseData();
    await initializeChromaDB();
    
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Configured for query embeddings' : 'Not configured (using keyword fallback)');
        
        if (courseCollection) {
            console.log('🚀 ChromaDB semantic search ready - FAST vector queries enabled!');
        } else {
            console.log('⚠️  ChromaDB not available - using keyword search fallback');
            console.log('💡 To enable fast semantic search: node scripts/setup-embeddings.js');
        }
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
}); 