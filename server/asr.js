require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function transcribeAudioChunk(base64Chunks) {
    if (!base64Chunks || base64Chunks.length === 0) return '';
    if (!Array.isArray(base64Chunks)) base64Chunks = [base64Chunks];

    const buffers = base64Chunks.map(b => Buffer.from(b, 'base64'));
    const pcmBuffer = Buffer.concat(buffers);
    const wavBuffer = createWavBuffer(pcmBuffer);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Transcribe the speech in this audio precisely. Output ONLY the raw transcription without any conversational filler, markdown, or greetings.";

    const audioPart = {
        inlineData: {
            data: wavBuffer.toString("base64"),
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

function createWavBuffer(pcmBuffer) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);  // ← fixed offset
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);

    return Buffer.concat([header, pcmBuffer]);
}

module.exports = { transcribeAudioChunk };