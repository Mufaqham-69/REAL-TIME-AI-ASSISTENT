require('dotenv').config();
const OpenAI = require('openai');
const openai = new OpenAI();
async function run() {
    try {
        console.log("Key prefix:", process.env.OPENAI_API_KEY?.substring(0, 7));
        const res = await openai.models.list();
        console.log("Success! Models:", res.data.length);
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
