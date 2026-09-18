require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function transcribeAudioChunk(base64Chunks) {
    if (!base64Chunks || (Array.isArray(base64Chunks) && base64Chunks.length === 0)) return '';
    
    // The frontend's useAudioCapture builds a complete WAV file
    // and sends it as base64. Take the most recent chunk if there are multiple.
    const audioData = Array.isArray(base64Chunks) ? base64Chunks[base64Chunks.length - 1] : base64Chunks;

    if (!audioData || typeof audioData !== 'string' || audioData.length < 50) return '';

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = "Transcribe the English speech in this audio recording accurately. Output ONLY the raw spoken words as plain text without quotation marks, bullet points, formatting, or conversational replies. If there is no clear human speech, or only silence/background noise, reply with exactly: NO_SPEECH";

    const audioPart = {
        inlineData: {
            data: audioData,
            mimeType: "audio/wav"
        }
    };

    try {
        const result = await model.generateContent([prompt, audioPart]);
        let text = result.response.text().trim();
        
        // Strip out surrounding quotes if model added them
        text = text.replace(/^["']|["']$/g, '').trim();

        if (text === 'NO_SPEECH' || text.toLowerCase().includes('no speech') || text.length < 2) {
            return '';
        }

        console.log('[ASR] Transcribed speech:', text);
        return text;
    } catch (err) {
        console.error('[ASR] Gemini ASR Error:', err.message);
        return '';
    }
}

module.exports = { transcribeAudioChunk };

