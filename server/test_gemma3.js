require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
        const result = await model.generateContent("Hello, are you Gemma 3?");
        console.log("Response:", result.response.text());
    } catch (err) {
        console.error("Error Status Text:", err.statusText);
        console.error("Error Message:", err.message);
    }
}
test();
