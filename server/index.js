const express = require('express');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config();
const { streamAnswer, generateRecruiterQuestionsAndAnswers } = require('./llm');
const { transcribeAudioChunk } = require('./asr');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

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

// Direct HTTP transcription endpoint
app.post('/api/transcribe', async (req, res) => {
    try {
        const { audio } = req.body;
        if (!audio) return res.status(400).json({ error: 'Missing audio base64 data' });
        const text = await transcribeAudioChunk(audio);
        res.json({ text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const pdfParse = require('pdf-parse');

// Resume upload and parsing endpoint (PDF, TXT, MD)
app.post('/api/upload-resume', async (req, res) => {
    try {
        const { fileData, fileName, fileType } = req.body;
        if (!fileData) {
            return res.status(400).json({ error: 'No file data received.' });
        }

        const rawBuffer = Buffer.from(fileData, 'base64');
        let parsedText = '';
        const nameLower = (fileName || '').toLowerCase();

        if (nameLower.endsWith('.pdf') || fileType === 'application/pdf') {
            console.log(`[Server] Parsing PDF resume: ${fileName}...`);
            if (pdfParse.PDFParse) {
                const parser = new pdfParse.PDFParse({ data: rawBuffer });
                const res = await parser.getText();
                parsedText = res.text || '';
            } else if (typeof pdfParse === 'function') {
                const res = await pdfParse(rawBuffer);
                parsedText = res.text || '';
            }
        } else {
            // Text or Markdown
            parsedText = rawBuffer.toString('utf-8');
        }

        // Clean redundant line breaks and whitespace
        parsedText = parsedText
            .replace(/\r\n/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const words = parsedText.split(/\s+/).filter(Boolean).length;
        console.log(`[Server] Resume parsed successfully: ${fileName} (${words} words)`);

        res.json({
            success: true,
            fileName: fileName || 'uploaded_resume',
            wordCount: words,
            text: parsedText
        });
    } catch (err) {
        console.error('[Server] Resume parse error:', err.message);
        res.status(500).json({ error: `Failed to parse resume: ${err.message}` });
    }
});

// Senior Recruiter Q&A and Resume Analysis endpoint
app.post('/api/recruiter-prep', async (req, res) => {
    try {
        const { resume, role } = req.body;
        if (!resume || resume.trim().length < 20) {
            return res.status(400).json({ error: 'Please upload or paste a valid resume first.' });
        }

        console.log(`[Server] Generating Senior Recruiter prep for role: "${role || 'General'}"...`);
        const result = await generateRecruiterQuestionsAndAnswers({ resume, role });
        res.json({
            success: true,
            summary: result.summary,
            questions: result.questions || []
        });
    } catch (err) {
        console.error('[Server] Recruiter prep error:', err.message);
        res.status(500).json({ error: `Recruiter prep failed: ${err.message}` });
    }
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

async function handleGenerateAnswer(ws, state, question, timings = {}) {
    const now = Date.now();
    const timeSinceLast = now - state.lastRequestTime;

    console.log(`[Server] Generating answer for: "${question ? question.substring(0, 60) : ''}..."`);

    // 1. Quota Protection: Ignore if already generating
    if (state.isGenerating) {
        console.warn('[Server] Ignored: Already generating an answer.');
        return;
    }

    // 2. Debounce rate limit (1s debounce)
    if (timeSinceLast < 1000) {
        console.warn(`[Server] Rate limited. Debouncing duplicate trigger.`);
        return;
    }

    if (!question || question.trim().length < 2) {
        console.log('[Server] Question too short, ignoring.');
        return;
    }

    state.isGenerating = true;
    state.lastRequestTime = now;

    sendJson(ws, { 
        type: 'llm_start', 
        question: question.trim(),
        asrTime: timings.asrTime || 0
    });

    try {
        await streamAnswer({
            question: question.trim(),
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
}

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
                    await handleGenerateAnswer(ws, state, question);
                    break;
                }

                case 'audio_chunk': {
                    const audioBase64 = data.data || data.audio;
                    if (!audioBase64) return;

                    sendJson(ws, { type: 'asr_start' });
                    const asrStart = Date.now();
                    try {
                        const text = await transcribeAudioChunk(audioBase64);
                        const asrTime = Date.now() - asrStart;

                        if (text && text.trim().length >= 2) {
                            console.log(`[Server] Transcribed audio in ${asrTime}ms: "${text}"`);
                            sendJson(ws, { type: 'transcript_final', text: text.trim(), asrTime });
                            await handleGenerateAnswer(ws, state, text.trim(), { asrTime });
                        } else {
                            sendJson(ws, { type: 'asr_empty' });
                        }
                    } catch (asrErr) {
                        console.error('[Server] Audio chunk ASR error:', asrErr.message);
                        sendJson(ws, { type: 'error', message: `ASR Error: ${asrErr.message}` });
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
    console.log(`[Server] ASR: Gemini 2.5 Flash Audio Engine`);
    console.log(`[Server] ========================================`);
});