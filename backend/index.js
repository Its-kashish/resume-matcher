require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());
// Parse incoming requests JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for memory storage (files stored in buffers)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Trim and clean excess whitespace from text
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

// Helper: Call the Gemini API using @google/genai SDK
async function callGemini(resumeText, jobDescription, role, experienceLevel) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the backend .env file.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a strict ATS (Applicant Tracking System) resume evaluator.

Before evaluation, understand the user's context:
- Target Role: ${role || 'general software internship'}
- Experience Level: ${experienceLevel || 'beginner'} (beginner / intermediate / advanced)

Your task is to compare a resume with a job description and produce a factual, evidence-based analysis.

━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES:
━━━━━━━━━━━━━━━━━━━━━━
- ONLY use information explicitly present in the resume and job description.
- DO NOT assume, guess, or infer any skill, experience, or ability.
- If something is not clearly mentioned, treat it as UNKNOWN (not missing).
- DO NOT use subjective or emotional language (e.g., strong, excellent, highly skilled).
- DO NOT describe any skill as "strong", "good", or "demonstrated" unless it is explicitly stated in the resume. Only repeat what is directly written. Do not interpret.
- Do NOT add external industry expectations unless explicitly mentioned in the job description.
- Be neutral, factual, and consistent.

━━━━━━━━━━━━━━━━━━━━━━
EVALUATION PROCESS:
━━━━━━━━━━━━━━━━━━━━━━
1. Extract only explicit facts from resume and job description.
2. Compare resume facts with job requirements.
3. Identify only direct matches and direct gaps.
4. Compute score based only on visible overlap.

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY):
━━━━━━━━━━━━━━━━━━━━━━
{
  "match_score": number (0-100),

  "reason": "Short clear explanation of why this score was given based only on resume-job match",

  "score_breakdown": {
    "skills_match": number,
    "projects_relevance": number,
    "experience_relevance": number,
    "overall_alignment": number
  },

  "strengths": [
    "Only explicit strengths found in resume that match job description"
  ],

  "weaknesses": [
    "Only explicit gaps between resume and job description"
  ],

  "missing_skills": [
    "Skills required in job description but not found in resume"
  ],

  "suggestions": [
    "Practical improvement suggestions strictly based on detected gaps"
  ]
}

━━━━━━━━━━━━━━━━━━━━━━
INPUT:
━━━━━━━━━━━━━━━━━━━━━━

Resume:
${resumeText}

Job Description:
${jobDescription}

Return ONLY valid JSON. No explanation outside JSON. No markdown.`;

  // Call the Gemini model. We enforce JSON output using responseMimeType: "application/json"
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  return response.text;
}

// Helper: Parse and validate response structure
function parseAIResponse(text) {
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  // Strip markdown code block formatting if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);

  // Validate the properties required by the prompt
  const requiredFields = ['match_score', 'reason', 'score_breakdown', 'strengths', 'weaknesses', 'missing_skills', 'suggestions'];
  for (const field of requiredFields) {
    if (!parsed.hasOwnProperty(field)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Double-check types and apply fallbacks to ensure client-side stability
  if (typeof parsed.match_score !== 'number') {
    parsed.match_score = parseInt(parsed.match_score, 10) || 0;
  }
  if (typeof parsed.reason !== 'string') {
    parsed.reason = String(parsed.reason || '');
  }
  if (!parsed.score_breakdown || typeof parsed.score_breakdown !== 'object') {
    parsed.score_breakdown = { skills_match: 0, projects_relevance: 0, experience_relevance: 0, overall_alignment: 0 };
  } else {
    // Sanitize breakdown scores
    const breakdownFields = ['skills_match', 'projects_relevance', 'experience_relevance', 'overall_alignment'];
    for (const bField of breakdownFields) {
      if (typeof parsed.score_breakdown[bField] !== 'number') {
        parsed.score_breakdown[bField] = parseInt(parsed.score_breakdown[bField], 10) || 0;
      }
    }
  }
  if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
  if (!Array.isArray(parsed.weaknesses)) parsed.weaknesses = [];
  if (!Array.isArray(parsed.missing_skills)) parsed.missing_skills = [];
  if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];

  return parsed;
}

// Route: POST /api/analyze-resume
app.post('/api/analyze-resume', upload.single('resume_file'), async (req, res) => {
  try {
    let resumeText = '';

    // 1. Extract text from uploaded PDF or use pasted fallback text
    if (req.file) {
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: "Uploaded file must be a PDF." });
      }
      try {
        const pdfData = await pdfParse(req.file.buffer);
        resumeText = pdfData.text;
      } catch (err) {
        console.error("PDF Parsing Error:", err);
        return res.status(400).json({ error: "Failed to parse PDF file. Ensure it is not corrupted or password protected." });
      }
    } else if (req.body.resume_text) {
      resumeText = req.body.resume_text;
    }

    const jobDescription = req.body.job_description;
    const role = req.body.role || 'general software internship';
    const experienceLevel = req.body.experience_level || 'beginner';

    // 2. Validate both inputs exist
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: "Resume content is required (upload a PDF or paste text)." });
    }
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: "Job description is required." });
    }

    // 3. Trim + clean text
    const cleanedResume = cleanText(resumeText);
    const cleanedJD = cleanText(jobDescription);

    console.log(`Analyzing compatibility for role "${role}" (${experienceLevel}). Resume: ${cleanedResume.length} chars, JD: ${cleanedJD.length} chars.`);

    // 4. Send to Gemini with retry logic
    let result = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Sending call to Gemini API (Attempt ${attempt}/2)...`);
        const responseText = await callGemini(cleanedResume, cleanedJD, role, experienceLevel);
        result = parseAIResponse(responseText);
        break; // Success!
      } catch (err) {
        console.error(`Attempt ${attempt} failed: ${err.message}`);
        lastError = err;

        // Skip retry if API Key issue is identified immediately
        if (err.message.includes("GEMINI_API_KEY") || err.message.includes("API key")) {
          break;
        }
      }
    }

    // 5. Send result or return JSON structure error
    if (result) {
      return res.json(result);
    } else {
      console.error("Failed to fetch or parse a valid response after all attempts.");
      if (lastError && (lastError.message.includes("GEMINI_API_KEY") || lastError.message.includes("API key"))) {
        return res.status(500).json({ error: "Gemini API key is invalid or not configured. Set GEMINI_API_KEY in the backend .env file." });
      }
      return res.status(500).json({ error: "AI response invalid" });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "An unexpected server error occurred: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
