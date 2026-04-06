require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = "Transcribe the speech in this audio precisely.";
        
        const audioPart = {
            inlineData: {
                data: wavBuffer.toString("base64"),
                mimeType: "audio/wav"
            }
        };

        const result = await model.generateContent([prompt, audioPart]);
        console.log("Response:", result.response.text());
    } catch (err) {
        console.log(err);
    }
}
run();
