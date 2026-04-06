require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe a base64 PCM chunk using Whisper API.
 * For production: use Deepgram WebSocket for true streaming.
 */
async function transcribeAudioChunk(base64Data) {
    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Write to temp WAV file (Whisper needs a file, not raw PCM)
    const tmpPath = path.join(os.tmpdir(), `chunk_${Date.now()}.wav`);
    writeWavFile(tmpPath, buffer);

    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath),
            model: 'whisper-1',
            language: 'en',
            response_format: 'text',
        });
        return response?.trim() || '';
    } finally {
        // Ensure cleanup happens even if the API throws an error
        if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
        }
    }
}

/**
 * Write a minimal WAV file header around raw PCM Int16 data.
 */
function writeWavFile(filePath, pcmBuffer) {
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
    header.writeUInt32LE(16, 16);           // PCM chunk size
    header.writeUInt16LE(1, 20);            // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 26);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);

    fs.writeFileSync(filePath, Buffer.concat([header, pcmBuffer]));
}

module.exports = { transcribeAudioChunk };