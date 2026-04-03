require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { transcribeAudioChunk, finalizeTranscript } = require('./asr');
const { streamAnswer } = require('./llm');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    let audioBuffer = [];
    let transcriptBuffer = '';
    let resume = '';
    let role = '';

    ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {

            // Client sends resume + role at session start
            case 'session_init':
                resume = msg.resume || '';
                role = msg.role || 'Software Engineer';
                console.log('Session initialized for:', role);
                break;

            // Streaming audio chunks (base64 PCM Int16)
            case 'audio_chunk':
                audioBuffer.push(msg.data);

                // Real-time partial transcript via Deepgram (or batch via Whisper)
                try {
                    const partial = await transcribeAudioChunk(msg.data);
                    if (partial) {
                        transcriptBuffer = partial;
                        ws.send(JSON.stringify({
                            type: 'transcript_partial',
                            text: transcriptBuffer
                        }));
                    }
                } catch (err) {
                    console.error('ASR error:', err.message);
                }
                break;

            // Silence detected — finalize transcript and generate answer
            case 'silence_detected':
                if (!transcriptBuffer.trim()) {
                    audioBuffer = [];
                    break;
                }

                const finalText = transcriptBuffer.trim();
                transcriptBuffer = '';
                audioBuffer = [];

                // Send final transcript to client
                ws.send(JSON.stringify({
                    type: 'transcript_final',
                    text: finalText
                }));

                // Stream LLM answer back
                try {
                    await streamAnswer({
                        question: finalText,
                        resume,
                        role,
                        onToken: (token) => {
                            ws.send(JSON.stringify({ type: 'answer_chunk', token }));
                        },
                        onDone: () => {
                            ws.send(JSON.stringify({ type: 'answer_done' }));
                        }
                    });
                } catch (err) {
                    console.error('LLM error:', err.message);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Failed to generate answer'
                    }));
                }
                break;

            // Manual trigger (user presses hotkey to force answer generation)
            case 'manual_trigger':
                const question = msg.question || transcriptBuffer;
                if (!question.trim()) break;

                ws.send(JSON.stringify({ type: 'transcript_final', text: question }));
                ws.send(JSON.stringify({ type: 'answer_chunk', token: '' }));

                await streamAnswer({
                    question,
                    resume,
                    role,
                    onToken: (token) => ws.send(JSON.stringify({ type: 'answer_chunk', token })),
                    onDone: () => ws.send(JSON.stringify({ type: 'answer_done' }))
                });
                break;
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));