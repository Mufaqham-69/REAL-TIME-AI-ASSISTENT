require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
    try {
        const pcmBuffer = Buffer.alloc(16000 * 2, 0); // 1 sec silent pcm
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + pcmBuffer.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(16000, 26);
        header.writeUInt32LE(32000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(pcmBuffer.length, 40);

        const wavBuffer = Buffer.concat([header, pcmBuffer]);
        
        const form = new FormData();
        form.append('file', wavBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
        form.append('model', 'whisper-1');
        form.append('response_format', 'text');

        console.log("Transcribing chunk via axios...");
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });
        console.log("Text:", response.data);
    } catch(e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
run();
