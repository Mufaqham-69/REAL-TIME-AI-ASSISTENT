require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test_models() {
    const models = [
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-pro-latest"
    ];
    for (const m of models) {
        try {
            console.log(`Testing model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`SUCCESS [${m}]:`, result.response.text());
        } catch (err) {
            console.error(`FAILURE [${m}]:`, err.statusText || err.message);
        }
    }
}
test_models();
