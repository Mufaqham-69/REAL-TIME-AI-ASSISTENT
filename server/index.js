const express = require('express');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const { streamAnswer } = require('./llm');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// State management per client to prevent quota abuse
const clientState = new Map();

wss.on('connection', (ws) => {
    console.log('[Server] New Client connect');
    
    // Initialize state for this specific connection
    const state = {
        resume: '',
        role: '',
        isGenerating: false,
        lastRequestTime: 0
    };
    clientState.set(ws, state);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            const state = clientState.get(ws);

            switch (data.type) {
                case 'session_init':
                    state.resume = data.resume;
                    state.role = data.role;
                    console.log('[Server] Session init:', state.role);
                    break;

                case 'text_partial':
                    // Just echo partials back if needed (or ignore)
                    break;

                case 'text_question':
                case 'manual_trigger':
                    const question = data.text;
                    const now = Date.now();
                    const timeSinceLast = now - state.lastRequestTime;

                    console.log(`[Server] Received question: "${question.substring(0, 50)}..."`);

                    // 1. Quota Protection: Ignore if already generating
                    if (state.isGenerating) {
                        console.warn('[Server] Ignored: Already generating an answer.');
                        return;
                    }

                    // 2. Quota Protection: 3-second debounce
                    if (timeSinceLast < 3000) {
                        console.warn(`[Server] Ignored: Rate limited. Wait ${Math.ceil((3000 - timeSinceLast)/1000)}s.`);
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            text: 'Rate Limit: Please wait 3 seconds between questions to preserve your API quota.' 
                        }));
                        return;
                    }

                    if (!question || question.trim().length < 5) {
                        console.log('[Server] Question too short, ignoring.');
                        return;
                    }

                    state.isGenerating = true;
                    state.lastRequestTime = now;

                    ws.send(JSON.stringify({ type: 'llm_start' }));

                    try {
                        await streamAnswer({
                            question,
                            resume: state.resume,
                            role: state.role,
                            onToken: (token) => {
                                ws.send(JSON.stringify({ type: 'answer_chunk', token }));
                            },
                            onDone: () => {
                                ws.send(JSON.stringify({ type: 'answer_done' }));
                                state.isGenerating = false;
                            }
                        });
                    } catch (err) {
                        console.error('[Server] LLM Error:', err.message);
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            text: `LLM Error: ${err.message}` 
                        }));
                        state.isGenerating = false;
                    }
                    break;
            }
        } catch (err) {
            console.error('[Server] Socket Error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Server] Client disconnected');
        clientState.delete(ws);
    });
});

server.listen(PORT, () => {
    console.log(`[Server] --- ONLINE ---`);
    console.log(`[Server] Port: ${PORT}`);
    console.log(`[Server] Mode: Quota-Protected Gemma 3`);
});