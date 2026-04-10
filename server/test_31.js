require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test_31() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
        const result = await model.generateContent("Hi");
        console.log("SUCCESS:", result.response.text());
    } catch (err) {
        console.error("FAILURE:", err.message);
    }
}
test_31();
