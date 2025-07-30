const { ChromaClient } = require('chromadb');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// ChromaDB client
const client = new ChromaClient();

// Generate embeddings using OpenAI
async function generateEmbedding(text) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    try {
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

        return response.data.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error.response?.data || error.message);
        throw error;
    }
}

// Load course data
async function loadCourseData() {
    const courses = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(path.join(__dirname, '../data', 'courses.csv'))
            .pipe(csv())
            .on('data', (row) => {
                courses.push(row);
            })
            .on('end', () => {
                console.log(`Loaded ${courses.length} courses`);
                resolve(courses);
            })
            .on('error', reject);
    });
}

// Create collection and populate with embeddings
async function setupCourseEmbeddings() {
    try {
        console.log('🚀 Starting ChromaDB course embeddings setup...');
        
        // Load courses
        const courses = await loadCourseData();
        
        // Create or get collection
        let collection;
        try {
            await client.deleteCollection({ name: "course_embeddings" });
            console.log('Deleted existing collection');
        } catch (error) {
            // Collection doesn't exist, that's fine
        }
        
        collection = await client.createCollection({
            name: "course_embeddings",
            metadata: { "hnsw:space": "cosine" }
        });
        console.log('✅ Created ChromaDB collection: course_embeddings');

        // Process courses in batches
        const batchSize = 50;
        const totalBatches = Math.ceil(courses.length / batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIdx = batchIndex * batchSize;
            const endIdx = Math.min(startIdx + batchSize, courses.length);
            const batch = courses.slice(startIdx, endIdx);
            
            console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (courses ${startIdx + 1}-${endIdx})`);
            
            const ids = [];
            const embeddings = [];
            const metadatas = [];
            const documents = [];
            
            for (const course of batch) {
                const courseKey = `${course.Subject}_${course.Number}`;
                const courseName = course.Name || '';
                const courseDescription = course.Description || '';
                
                // Create text for embedding
                const courseText = `${courseDescription} ${courseName}`.trim();
                
                if (courseText.length < 20) {
                    console.log(`⚠️  Skipping ${courseKey} - insufficient text`);
                    continue;
                }
                
                try {
                    // Generate embedding
                    const embedding = await generateEmbedding(courseText);
                    
                    // Prepare data for ChromaDB
                    ids.push(courseKey);
                    embeddings.push(embedding);
                    documents.push(courseText);
                    metadatas.push({
                        subject: course.Subject,
                        number: course.Number,
                        name: courseName,
                        description: courseDescription,
                        credits: course.Credits || '',
                        restrictions: course.Restrictions || ''
                    });
                    
                    console.log(`✓ ${courseKey}: Generated embedding (${embedding.length}D)`);
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.error(`❌ Error processing ${courseKey}:`, error.message);
                }
            }
            
            // Add batch to ChromaDB
            if (ids.length > 0) {
                await collection.add({
                    ids,
                    embeddings,
                    metadatas,
                    documents
                });
                console.log(`✅ Added ${ids.length} courses to ChromaDB`);
            }
        }
        
        // Get final count
        const count = await collection.count();
        console.log(`🎉 Successfully created embeddings for ${count} courses!`);
        console.log('📈 ChromaDB setup complete. Semantic search will now be much faster!');
        
    } catch (error) {
        console.error('💥 Error setting up course embeddings:', error);
        process.exit(1);
    }
}

// Run the setup
if (require.main === module) {
    setupCourseEmbeddings();
}

module.exports = { setupCourseEmbeddings, generateEmbedding }; 