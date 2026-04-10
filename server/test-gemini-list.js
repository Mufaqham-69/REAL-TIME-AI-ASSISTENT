const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');

async function run() {
    try {
        console.log("Listing models...");
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
        const data = await response.json();
        const content = JSON.stringify(data, null, 2);
        fs.writeFileSync('models_list.json', content);
        console.log("Written to models_list.json");
    } catch (err) {
        console.log(err);
    }
}
run();
