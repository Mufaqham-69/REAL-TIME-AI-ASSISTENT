require('dotenv').config();
const { Deepgram } = require('@deepgram/sdk');

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

async function run() {
    try {
        console.log("Testing Deepgram API connection...");
        const response = await deepgram.transcription.preRecorded({
            url: 'https://dprm.deepgram.com/static/samples/deepgram.wav',
        }, {
            model: 'nova-2',
            smart_format: true
        });

        console.log("Success! Transcript:", response.results.channels[0].alternatives[0].transcript);
    } catch(e) {
        console.error("Deepgram Error:", e);
    }
}
run();
