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

module.exports = { streamAnswer };