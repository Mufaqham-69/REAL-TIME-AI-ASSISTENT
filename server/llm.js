const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Stream an answer to an interview question.
 * Injects resume context and role into the prompt.
 */
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

    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 300,
        stream: true,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Interview question: "${question}"\n\nProvide a strong suggested answer:` }
        ],
        temperature: 0.7,
    });

    for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) onToken(token);
    }

    onDone?.();
}

module.exports = { streamAnswer };