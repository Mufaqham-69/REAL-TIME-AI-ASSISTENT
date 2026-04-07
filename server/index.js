require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const { streamAnswer } = require('./llm');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => res.send('OK'));
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

            // Handle partial incoming transcripts from client native ASR
            case 'client_transcript_partial':
                ws.send(JSON.stringify({ type: 'transcript_partial', text: msg.text || '' }));
                break;

            // Handle final incoming transcript - triggers LLM
            case 'client_transcript_final':
                const finalText = (msg.text || '').trim();
                if (!finalText) break;

                // Send final transcript back to confirm
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