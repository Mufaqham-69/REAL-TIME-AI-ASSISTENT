require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function streamAnswer({ question, resume, role, onToken, onDone }) {
    const systemPrompt = `You are an expert interview coach helping a candidate answer interview questions in real-time.

Role being interviewed for: ${role}

Candidate's resume/background:
${resume || 'No resume provided. Give general best-practice answers.'}

Instructions:
- Give a concise, confident, well-structured answer (2-4 sentences for behavioral, 3-6 for technical)
- Use the STAR method (Situation, Task, Action, Result) for behavioral questions
- For technical questions, be precise and mention key concepts
- Match the tone to the question type (conversational for HR, precise for technical)
- Do NOT include filler phrases like "Great question!" or "Certainly!"
- Format as plain text, no markdown`;

    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',  // ← fixed
        systemInstruction: systemPrompt
    });

    const prompt = `Interview question: "${question}"\n\nProvide a strong suggested answer:`;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
        const token = chunk.text();
        if (token) onToken(token);
    }

    onDone?.();
}

module.exports = { streamAnswer };