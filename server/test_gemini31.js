require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
        const result = await model.generateContent("Hello, are you Gemini 3.1 Pro?");
        console.log("Response:", result.response.text());
    } catch (err) {
        console.error("Error:", err.message);
    }
}
test();
