require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function transcribeAudioChunk(base64Chunks) {
    if (!base64Chunks || base64Chunks.length === 0) return '';
    
    // The frontend's useAudioCapture now builds a complete WAV file for us 
    // and sends it as base64 in the array. We take the most recent chunk if there are multiple.
    const audioData = Array.isArray(base64Chunks) ? base64Chunks[base64Chunks.length - 1] : base64Chunks;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Transcribe the speech in this audio precisely. Output ONLY the raw transcription without any conversational filler, markdown, or greetings.";

    const audioPart = {
        inlineData: {
            data: audioData,
            mimeType: "audio/wav"
        }
    };

    try {
        const result = await model.generateContent([prompt, audioPart]);
        return result.response.text().trim();
    } catch (err) {
        console.error('Gemini ASR Error:', err.message);
        return '';
    }
}

module.exports = { transcribeAudioChunk };
