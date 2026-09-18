const express = require('express');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config();
const { streamAnswer } = require('./llm');

const app = express();
app.use(cors());
app.use(express.json());

// Basic health check and status endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        clients: wss.clients.size
    });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// Helper to safely send JSON payload over WebSocket
function sendJson(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(payload));
        } catch (err) {
            console.error('[Server] Failed to send WS message:', err.message);
        }
    }
}

// State management per client to prevent quota abuse
const clientState = new Map();

wss.on('connection', (ws) => {
    console.log('[Server] New Client connected');
    
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
            if (!state) return;

            switch (data.type) {
                case 'session_init':
                    state.resume = data.resume || '';
                    state.role = data.role || '';
                    console.log('[Server] Session initialized for role:', state.role || 'Unspecified');
                    break;

                case 'text_partial':
                    sendJson(ws, { type: 'transcript_partial', text: data.text });
                    break;

                case 'text_question':
                case 'manual_trigger': {
                    const question = data.text;
                    sendJson(ws, { type: 'transcript_final', text: question });
                    
                    const now = Date.now();
                    const timeSinceLast = now - state.lastRequestTime;

                    console.log(`[Server] Received question: "${question ? question.substring(0, 60) : ''}..."`);

                    // 1. Quota Protection: Ignore if already generating
                    if (state.isGenerating) {
                        console.warn('[Server] Ignored: Already generating an answer.');
                        return;
                    }

                    // 2. Debounce rate limit (1.5s debounce is plenty for human conversational turn)
                    if (timeSinceLast < 1500) {
                        const waitSec = Math.ceil((1500 - timeSinceLast) / 1000);
                        console.warn(`[Server] Rate limited. Please wait ${waitSec}s.`);
                        sendJson(ws, { 
                            type: 'error', 
                            message: `Rate Limit: Please wait a moment between questions.`,
                            text: `Rate Limit: Please wait a moment between questions.` 
                        });
                        return;
                    }

                    if (!question || question.trim().length < 3) {
                        console.log('[Server] Question too short, ignoring.');
                        return;
                    }

                    state.isGenerating = true;
                    state.lastRequestTime = now;

                    sendJson(ws, { type: 'llm_start' });

                    try {
                        await streamAnswer({
                            question,
                            resume: state.resume,
                            role: state.role,
                            onToken: (token) => {
                                sendJson(ws, { type: 'answer_chunk', token });
                            },
                            onDone: () => {
                                sendJson(ws, { type: 'answer_done' });
                                state.isGenerating = false;
                            }
                        });
                    } catch (err) {
                        console.error('[Server] LLM Error:', err.message);
                        sendJson(ws, { 
                            type: 'error', 
                            message: `LLM Error: ${err.message}`,
                            text: `LLM Error: ${err.message}` 
                        });
                        state.isGenerating = false;
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('[Server] Socket Error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Server] Client disconnected');
        clientState.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('[Server] WebSocket connection error:', err.message);
        clientState.delete(ws);
    });
});

server.listen(PORT, () => {
    console.log(`[Server] ========================================`);
    console.log(`[Server] Real-Time AI Assistant Server ONLINE`);
    console.log(`[Server] Port: ${PORT}`);
    console.log(`[Server] Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
    console.log(`[Server] ========================================`);
});