# Real-Time AI Interview Assistant

A low-latency, real-time AI assistant built specifically for live interview coaching. It sits transparently as an overlay above your other windows (like Zoom, Teams, or Google Meet) and provides instant, context-aware suggestions for interview questions by listening to your system or microphone audio in real-time.

## 🚀 How It Works (The Models)

This application achieves near zero-latency performance by utilizing a specific hybrid architecture:

1. **Frontend ASR (Speech-to-Text)**: Instead of gathering audio, bundling it into WAV files, and uploading it to a backend server, this application uses Google Chrome's native **Web Speech API** (`window.SpeechRecognition`). This guarantees instant, zero-latency local transcription of the interviewer's questions without hitting external API rate limits.
2. **Backend LLM (Text-to-Text)**: The intelligently transcribed text is passed instantly over WebSockets to the Node.js backend. By default, the backend is powered by **Google's `gemini-1.5-flash`** model. Because we bypass multimodal audio generation and only process raw text, Gemini streams back the suggested interview responses in less than 1 second.

*(Note: The codebase was originally authored to support `@deepgram/sdk` for ASR and `openai` for LLM, but these were swapped in favor of zero-latency free alternatives due to API rate-limit bottlenecks).*

## 🛠️ Technology Stack

* **Frontend Client**: React, Vite
* **Backend Server**: Node.js, Express, WebSockets (`ws`)
* **Desktop Application Wrapper**: Electron (Borderless, floating, transparent overlay)
* **AI Tooling**: `@google/generative-ai`

## ⚙️ Setup Instructions

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your system.

### 1. Environment Variables
Create a `.env` file in the `server` directory and add your Google Gemini API key along with the port configurations:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
VITE_WS_URL=ws://localhost:3001
```

### 2. Install Dependencies

You need to install dependencies for both the backend server and the frontend client.

```bash
# In the root (server) directory:
cd server
npm install

# In the client directory:
cd server/client
npm install
```

## ▶️ Running the Application

This is a multi-service application. You'll need three separate terminal windows to run the stack locally.

**1. Start the Backend Server**
```bash
cd server
npm start
```
*Runs on `http://localhost:3001`*

**2. Start the Frontend Client**
```bash
cd server/client
npm run dev
```
*Runs on `http://localhost:3000`*

**3. Launch the Electron Overlay**
```bash
cd server
npx electron ./electron/main.js
```

### ⌨️ User Controls & Shortcuts
Once the Electron overlay is floating on your screen, it will stay on top of all other windows.
* **Toggle Visibility**: Press **`Ctrl + Shift + H`** (or `Cmd + Shift + H` on Mac) to hide or show the AI Assistant instantly during your interview.

## 💡 Integrating Custom Models
The WebSocket architecture makes it extremely easy to plug in custom or locally-built models. If you are building a fine-tuned model for this app:
1. Go into `server/index.js` and locate the `streamAnswer()` block execution inside the `client_transcript_final` switch case.
2. Direct the `question` payload to your custom model's inference API (e.g., local Ollama, huggingface endpoint) and simply fire `ws.send({ type: 'answer_chunk', token })` as your new model streams its response!
