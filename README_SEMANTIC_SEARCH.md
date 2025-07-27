# AI-Powered Semantic Course Search

This feature adds intelligent course discovery to MajorMap using OpenAI's GPT models to interpret student career goals and learning interests.

## 🚀 Features

- **Natural Language Input**: Students describe their career goals or interests in plain English
- **AI-Powered Analysis**: OpenAI GPT analyzes the input and generates relevant academic keywords
- **Semantic Matching**: Courses are ranked based on relevance to the generated keywords
- **Smart Recommendations**: Results show match percentages and highlighted relevant keywords
- **One-Click Addition**: Students can instantly add recommended courses to their academic plan

## 🛠 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure OpenAI API
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Copy `.env.example` to `.env`
3. Add your OpenAI API key:
```bash
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Run the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## 📱 How to Use

1. **Access AI Search**: Click the "AI Search" button (brain icon) in the top-right corner
2. **Describe Your Goals**: Enter your career interests or learning objectives
   - Example: "I want to become a data scientist"
   - Example: "I'm interested in cybersecurity and network security"
   - Example: "I need courses about machine learning and AI"
3. **Review Results**: Browse the ranked course recommendations with relevance scores
4. **Add Courses**: Click "Add to Plan" to include courses in your academic timeline
5. **View Details**: Click "Details" to see full course information

## 🔧 Technical Implementation

### Backend (`server.js`)
- **Express.js server** with OpenAI API integration
- **Intelligent fallback** to local keyword analysis if API is unavailable
- **Secure API key handling** through environment variables

### Frontend (`app.js`)
- **Beautiful modal interface** for user input
- **Real-time loading indicators** during AI processing  
- **Smart course ranking** based on keyword matches in names and descriptions
- **Interactive results** with one-click course addition

### AI Processing Flow
1. **User Input** → Student describes their interests
2. **OpenAI Analysis** → GPT generates relevant academic keywords
3. **Semantic Search** → Courses are scored based on keyword matches
4. **Ranked Results** → Top 15 courses displayed with relevance scores

## 🎯 Example Queries & Results

| Student Input | Generated Keywords | Top Course Matches |
|---------------|-------------------|-------------------|
| "I want to become a data scientist" | statistics, machine learning, data analysis, programming, mathematics | ITSC 3155 (Software Engineering), STAT 1220 (Statistics), MATH 1241 (Calculus) |
| "I'm interested in cybersecurity" | security, network security, cryptography, computer systems | ITSC 3146 (Network Security), ITSC 3181 (Computer Systems), ITSC 2214 (Data Structures) |
| "I need web development skills" | web programming, javascript, html, css, databases | ITSC 3155 (Software Engineering), ITSC 3200 (Web Programming), ITSC 3160 (Database Design) |

## 🔒 Fallback Mode

If the OpenAI API is unavailable or not configured, the system automatically falls back to local keyword analysis using predefined career/keyword mappings. This ensures the feature remains functional even without API access.

## 💡 Benefits

- **Personalized Discovery**: Find relevant courses based on individual career goals
- **Reduced Search Time**: No need to browse through hundreds of course descriptions
- **Improved Planning**: Make informed decisions about elective courses
- **Career Alignment**: Ensure course selections support specific career paths
- **Accessibility**: Natural language interface makes course discovery intuitive

## 🚧 Future Enhancements

- Integration with course prerequisites for smarter recommendations
- Career pathway suggestions with multi-semester planning
- Integration with job market data for trending skills
- Collaborative filtering based on successful student pathways
- Export recommendations to PDF or calendar formats 