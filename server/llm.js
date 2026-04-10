require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function streamAnswer({ question, resume, role, onToken, onDone }) {
    console.log('[LLM] Refined Gemma 3 Stream for:', question);
    
    // Highly refined persona for Gemma to match Gemini-tier quality
    const systemContext = `You are a world-class executive interview coach. You are helping a top-tier candidate practice for their interview.

Target Role: ${role}
Candidate Context: ${resume || 'General high-level candidate.'}

STRICT RESPONSE RULES:
1. Be concise but extremely high-impact (3-5 sentences total).
2. For behavioral questions, use a laser-focused STAR structure (Situation, Task, Action, Result).
3. For technical questions, mention industry-standard terminologies and best practices.
4. Speak as if you are advising a CEO. No fluff. No filler.
5. Provide a suggested answer that the candidate should say, not advice about how to answer.
6. Format as plain text ONLY.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

        const prompt = `${systemContext}\n\n[TRANSCRIPT]: "${question}"\n\n[COACH SUGGESTED ANSWER]:`;

        const result = await model.generateContentStream({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4, // Lower temperature for more consistent, professional quality
                topP: 0.8,
                maxOutputTokens: 256,
            }
        });

        for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) onToken(token);
        }

        console.log('[LLM] Completed refined stream');
        onDone?.();
    } catch (err) {
        console.error('[LLM] Refined Error:', err);
        throw err;
    }
}

module.exports = { streamAnswer };