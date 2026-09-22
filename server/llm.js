require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.warn('[LLM] WARNING: GEMINI_API_KEY is not defined in environment variables.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function streamAnswer({ question, resume, role, onToken, onDone }) {
    console.log('[LLM] Generating answer for question:', question);
    
    // Highly refined persona for live interview coaching
    const systemContext = `You are a world-class executive interview coach assisting a top-tier candidate in a live interview.

Target Role: ${role || 'Software Engineering / Technical Specialist'}
Candidate Context / Resume: ${resume || 'Senior-level engineering professional.'}

MANDATORY RESPONSE FORMAT & VISIBILITY RULES:
1. Speak in the first person as the candidate directly answering the interviewer ("I...", "My approach...").
2. ALWAYS divide the answer into 3 to 4 distinct, clearly separated talking points.
3. Every talking point MUST start on its own line with a bullet and bold category label:
   • **[Direct Strategy / Core Approach]:** [1-2 concise, impactful sentences]
   
   • **[Action / Architecture / Implementation]:** [1-2 sentences with concrete technologies, trade-offs, or methodologies]
   
   • **[Quantified Result / Business Impact]:** [1-2 sentences with concrete metrics, uptime, latency, scale, or outcomes]
4. ALWAYS leave a BLANK line between each bullet point so they never merge into a congested wall of text.
5. Emphasize key tools, frameworks, and metrics in **bold** (e.g., **99.9% uptime**, **Apache Kafka**, **40% latency reduction**).
6. NEVER include conversational pleasantries ("Sure, here is how to answer", "That is a great question"). Output ONLY the candidate's exact spoken words.`;

    const prompt = `${systemContext}\n\n[INTERVIEW QUESTION]: "${question}"\n\n[SEPARATED TALKING POINTS ANSWER]:`;

    const tryGenerate = async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContentStream({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                maxOutputTokens: 512,
            }
        });

        for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) onToken(token);
        }
    };

    try {
        await tryGenerate(PRIMARY_MODEL);
        console.log(`[LLM] Completed stream using ${PRIMARY_MODEL}`);
        onDone?.();
    } catch (err) {
        console.warn(`[LLM] Primary model ${PRIMARY_MODEL} failed:`, err.message);
        // Fallback to secondary model if primary fails
        if (PRIMARY_MODEL !== FALLBACK_MODEL) {
            try {
                console.log(`[LLM] Retrying with fallback model: ${FALLBACK_MODEL}...`);
                await tryGenerate(FALLBACK_MODEL);
                console.log(`[LLM] Completed stream using fallback ${FALLBACK_MODEL}`);
                onDone?.();
                return;
            } catch (fallbackErr) {
                console.error('[LLM] Fallback also failed:', fallbackErr.message);
                throw fallbackErr;
            }
        }
        throw err;
    }
}

async function generateRecruiterQuestionsAndAnswers({ resume, role }) {
    console.log('[LLM] Generating Senior Recruiter Q&As based on resume...');

    const prompt = `You are an elite Senior Technical Recruiter and Hiring Bar Raiser at a top-tier global tech company (e.g. Google, Meta, Amazon).
Conduct an in-depth audit of the candidate's resume and target role.

Target Role: ${role || 'Senior Software Engineer / Technical Specialist'}
Candidate Resume Context:
${resume}

YOUR GOAL:
1. Act as a demanding, intelligent Senior Recruiter. Analyze specific projects, technologies, claimed metrics, and experience in their resume.
2. Formulate 5 to 7 sharp, high-probability interview questions divided across 3 vital categories:
   - "Technical Deep-Dive": Drill into specific technologies, architectures, or technical trade-offs found on their resume.
   - "Behavioral & STAR": Probe high-pressure situations, engineering leadership, production incidents, or team conflicts.
   - "Resume Cross-Examination": Rigorously question specific metrics, achievements, transitions, or tool choices claimed in the resume.
3. For EACH question:
   - Explain what the recruiter is actually evaluating ("whatRecruiterLooksFor").
   - Provide an "Expert Model Answer" formulated as the candidate speaking directly in the first person ("I..."), using the STAR structure, explicitly referencing projects, metrics, and tools directly mentioned in their resume.

Return ONLY a valid JSON object matching this structure (no conversational chatter, no extra markdown):
{
  "summary": "2-3 concise sentences giving the senior recruiter's raw evaluation of the candidate's resume strengths and key vulnerability areas to prepare for.",
  "questions": [
    {
      "id": 1,
      "category": "Technical Deep-Dive",
      "question": "Question text here...",
      "difficulty": "Hard",
      "whatRecruiterLooksFor": "What the interviewer is testing here...",
      "modelAnswer": "• **Core Approach:** Direct opening strategy citing specific technologies.\\n• **Execution / Architecture:** Concrete implementation details from the resume.\\n• **Quantified Impact:** The business or performance outcome achieved."
    }
  ]
}`;

    const tryGenerateJson = async (modelName) => {
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.3,
                topP: 0.85,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json'
            }
        });

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        // Remove markdown code blocks if present
        rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(rawText);
    };

    try {
        const data = await tryGenerateJson(PRIMARY_MODEL);
        console.log(`[LLM] Generated ${data.questions?.length || 0} recruiter questions using ${PRIMARY_MODEL}`);
        return data;
    } catch (err) {
        console.warn(`[LLM] Primary model failed for recruiter prep:`, err.message);
        if (PRIMARY_MODEL !== FALLBACK_MODEL) {
            console.log(`[LLM] Trying fallback ${FALLBACK_MODEL}...`);
            const fallbackData = await tryGenerateJson(FALLBACK_MODEL);
            return fallbackData;
        }
        throw err;
    }
}

module.exports = { streamAnswer, generateRecruiterQuestionsAndAnswers };