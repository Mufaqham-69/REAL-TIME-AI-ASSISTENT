require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test_models() {
    const models = [
        "gemini-pro-latest",
        "gema-3-27b-it",
        "gemini-3-pro-preview",
        "gemini-2.0-flash-lite-preview",
        "gemini-1.5-pro-latest"
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
