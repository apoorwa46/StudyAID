

const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const PptxParser = require('node-pptx-parser').default; // Ensure .default is correct for your version
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // For local development only, Vercel handles env vars
const fs = require('fs').promises; // Use fs.promises for async file operations
const path = require('path'); // Node.js path module
const os = require('os'); // Node.js OS module for temporary directory
const axios = require('axios');
const cors = require('cors'); // Added for cross-origin requests if frontend is on a different port/domain

const PORT = process.env.PORT || 3000;

const app = express();

// Configure Multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json()); // To parse JSON request bodies
app.use(express.static('public')); // Serve your static frontend files (HTML, CSS, JS) from a 'public' directory
app.use(cors()); // Enable CORS for development, remove/configure for production if needed

// Helper function to handle file parsing and temporary file management
async function parseDocument(file) {
    let extractedText = '';
    let tempFilePath = null; // To store path of temporary file if created

    try {
        if (file.mimetype === 'application/pdf') {
            const data = await pdf(file.buffer);
            extractedText = data.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            // For PPTX, write buffer to a temporary file because node-pptx-parser needs a path
            // Use os.tmpdir() for a system-appropriate temporary directory
            tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.pptx`);
            await fs.writeFile(tempFilePath, file.buffer);

            const parser = new PptxParser(tempFilePath);
            const textContent = await parser.extractText();
            extractedText = textContent.map(slide => slide.text.join('\n')).join('\n\n');
        } else {
            throw new Error('Unsupported file type. Please upload a PDF or PPTX.');
        }
        return extractedText;
    } finally {
        // Ensure temporary file is deleted if it was created
        if (tempFilePath) {
            try {
                // Check if file exists before trying to unlink
                await fs.access(tempFilePath);
                await fs.unlink(tempFilePath);
            } catch (unlinkError) {
                console.warn(`Could not delete temporary file ${tempFilePath}:`, unlinkError);
            }
        }
    }
}


// Endpoint for Q&A generation
app.post('/generate-qa', upload.single('document'), async (req, res) => { // Changed 'file' to 'document' to match frontend
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const extractedText = await parseDocument(req.file);

        if (!extractedText.trim()) {
            return res.status(400).json({ error: 'Could not extract text from the provided file. Please ensure it contains readable text.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or "gemini-1.5-flash"

        const prompt = `Based on the following text, generate a comprehensive list of questions and answers that a student might find useful for studying. Focus on key concepts and important details. Format each Q&A pair clearly, for example:
        Q: What is the capital of France?
        A: The capital of France is Paris.
        Make sure to cover all major topics and concepts. And represent the Q&A in a clear and structured format.

        Text:
        ${extractedText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedQnA = response.text();

        res.json({ qna: generatedQnA });

    } catch (error) {
        console.error('Error generating Q&A:', error);
        res.status(500).json({ error: error.message || 'Error generating Q&A. Please try again or with a different file.' });
    }
});

// Video Suggestions using YouTube Data API
app.get('/api/video-suggestions', async (req, res) => {
    const topic = req.query.topic;
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    if (!topic) {
        return res.status(400).json({ error: 'Topic query parameter is required.' });
    }

    if (!youtubeApiKey) {
        console.error("YOUTUBE_API_KEY is not set in environment variables!");
        return res.status(500).json({ error: 'YouTube API Key is not configured in the server environment.' });
    }

    try {
        const youtubeApiUrl = 'https://www.googleapis.com/youtube/v3/search';
        const params = {
            key: youtubeApiKey,
            q: topic,
            part: 'snippet', // Request snippet for title, description, thumbnails, channel info
            type: 'video',  // Ensure only videos are searched
            maxResults: 6, // Get up to 6 results
            order: 'relevance' // Order results by relevance
        };

        const response = await axios.get(youtubeApiUrl, { params });

        const videos = response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : (item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : 'https://placehold.co/1280x720/E0E0E0/333333?text=No+Thumbnail'), // Fallback for thumbnails
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt
        }));

        res.json({ videos });

    } catch (error) {
        console.error('Error fetching video suggestions from YouTube API:', error.response ? error.response.data : error.message);
        let errorMessage = 'Failed to fetch video suggestions.';
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = `YouTube API Error: ${error.response.data.error.message}`;
            if (error.response.status === 403) {
                errorMessage += " (Possible quota limit reached or API key invalid).";
            }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
             errorMessage = "Could not connect to YouTube API. Check your internet connection or API status.";
        }
        res.status(500).json({ error: errorMessage });
    }
});


// 3. Summary Generator
app.post('/generate-summary', upload.single('document'), async (req, res) => { // Changed 'file' to 'document' to match frontend
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const extractedText = await parseDocument(req.file);

        if (!extractedText.trim()) {
            return res.status(400).json({ error: 'Could not extract text from the provided file. Please ensure it contains readable text.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or "gemini-1.5-flash"

        const prompt = `Summarize the following text concisely and accurately, highlighting the most important concepts and key takeaways. The summary should be easy for a student to understand and remember.
        Make sure to cover all major topics and concepts. And represent the summary in a clear and structured format.

        Text:
        ${extractedText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedSummary = response.text();

        res.json({ summary: generatedSummary });

    } catch (error) {
        console.error('Error generating summary:', error);
        res.status(500).json({ error: error.message || 'Error generating summary. Please try again or with a different file.' });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})