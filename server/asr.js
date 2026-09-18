require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function transcribeAudioChunk(base64Chunks) {
    if (!base64Chunks || (Array.isArray(base64Chunks) && base64Chunks.length === 0)) return '';
    
    // The frontend's useAudioCapture builds a complete WAV file
    // and sends it as base64. Take the most recent chunk if there are multiple.
    const audioData = Array.isArray(base64Chunks) ? base64Chunks[base64Chunks.length - 1] : base64Chunks;

    if (!audioData) return '';

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = "Transcribe the speech in this audio precisely. Output ONLY the raw transcription without any conversational filler, markdown, or greetings. If there is no speech, return an empty string.";

    const audioPart = {
        inlineData: {
            data: audioData,
            mimeType: "audio/wav"
        }
    };

    try {
        const result = await model.generateContent([prompt, audioPart]);
        const text = result.response.text().trim();
        console.log('[ASR] Transcribed:', text);
        return text;
    } catch (err) {
        console.error('Gemini ASR Error:', err.message);
        return '';
    }
}

module.exports = { transcribeAudioChunk };
