require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not defined in backend/.env file.");
    process.exit(1);
  }

  console.log("Found GEMINI_API_KEY prefix: " + apiKey.substring(0, 6) + "...");
  const ai = new GoogleGenAI({ apiKey });

  const resume = "Experienced software engineer with 5 years of experience in JavaScript, React, Node.js, and SQL. Built several CRUD web applications.";
  const jd = "Looking for a Frontend Developer with 3+ years experience. Required skills: React, TypeScript, and CSS. Node.js is a plus.";
  const role = "Frontend Developer";
  const experienceLevel = "intermediate";

  console.log("\nSending test prompt to Gemini API using model 'gemini-2.5-flash'...");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a strict ATS (Applicant Tracking System) resume evaluator.

Before evaluation, understand the user's context:
- Target Role: ${role}
- Experience Level: ${experienceLevel} (beginner / intermediate / advanced)

Your task is to compare a resume with a job description and produce a factual, evidence-based analysis.

━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES:
━━━━━━━━━━━━━━━━━━━━━━
- ONLY use information explicitly present in the resume and job description.
- DO NOT assume, guess, or infer any skill, experience, or ability.
- If something is not clearly mentioned, treat it as UNKNOWN (not missing).
- DO NOT use subjective or emotional language (e.g., strong, excellent, highly skilled).
- DO NOT describe any skill as "strong", "good", "indicated", or "demonstrated" unless it is explicitly stated in the resume. Only repeat what is directly written. Do not interpret.
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
${resume}

Job Description:
${jd}

Return ONLY valid JSON. No explanation outside JSON. No markdown.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;
    console.log("\n--- Raw Response ---");
    console.log(rawText);
    console.log("--------------------\n");

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(cleaned);
    console.log("Parsed JSON Successfully:");
    console.log(JSON.stringify(data, null, 2));

    if (
      typeof data.match_score === 'number' &&
      typeof data.reason === 'string' &&
      data.score_breakdown &&
      typeof data.score_breakdown.skills_match === 'number' &&
      typeof data.score_breakdown.projects_relevance === 'number' &&
      Array.isArray(data.strengths)
    ) {
      console.log("\nSUCCESS: The response matches the expected structure!");
    } else {
      console.log("\nFAILURE: JSON output is missing key properties or structure.");
    }
  } catch (err) {
    console.error("\nAPI Test Failed:", err.message);
  }
}

test();
