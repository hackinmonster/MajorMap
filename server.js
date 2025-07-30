const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/data', express.static('data'));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'templates', 'index.html'));
});

// Semantic search endpoint
app.post('/api/semantic-search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // OpenAI API integration
        const keywords = await getOpenAIKeywords(query);
        
        res.json({ keywords });
    } catch (error) {
        console.error('Semantic search error:', error);
        res.status(500).json({ error: 'Failed to process semantic search request' });
    }
});

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured (using fallback)');
}); 