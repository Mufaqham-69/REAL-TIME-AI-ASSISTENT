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
    
    // Highly refined persona for interview coaching
    const systemContext = `You are a world-class executive interview coach. You are helping a top-tier candidate practice for their live interview.

Target Role: ${role || 'Software Engineering / Tech Professional'}
Candidate Context: ${resume || 'General high-level candidate.'}

STRICT RESPONSE RULES:
1. Be concise, direct, and extremely high-impact (3-5 sentences maximum).
2. For behavioral questions, use a laser-focused STAR structure (Situation, Task, Action, Result).
3. For technical questions, mention industry-standard terminologies, architectures, and best practices.
4. Speak in the first person as the candidate directly answering the interviewer ("I did...", "My approach is...").
5. No conversational filler, no meta-advice (do NOT say "Here is an answer:"), just the direct answer.
6. Format as plain text ONLY.`;

    const prompt = `${systemContext}\n\n[INTERVIEW QUESTION]: "${question}"\n\n[YOUR DIRECT ANSWER]:`;

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