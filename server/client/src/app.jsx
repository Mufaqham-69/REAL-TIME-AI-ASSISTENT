import React, { useState, useRef, useCallback } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useWebSocket } from './hooks/useWebSocket';
import AnswerOverlay from './components/AnswerOverlay';
import TranscriptBar from './components/TranscriptBar';
import SetupPanel from './components/SetupPanel';

const WS_URL = 'ws://localhost:3001';

export default function App() {
    const [started, setStarted] = useState(false);
    const [resume, setResume] = useState('');
    const [role, setRole] = useState('');
    const [history, setHistory] = useState([]);

    const { connected, transcript, answer, isGenerating, send } =
        useWebSocket(WS_URL);

    // When silence detected, tell server to finalize
    const handleSilence = useCallback(() => {
        send({ type: 'silence_detected' });
    }, [send]);

    // Send audio chunk to server
    const handleChunk = useCallback((base64Chunk) => {
        send({ type: 'audio_chunk', data: base64Chunk });
    }, [send]);

    const { start, stop, isListening } = useAudioCapture({
        onChunk: handleChunk,
        onSilence: handleSilence,
    });

    const handleStart = () => {
        // Initialize session with resume
        send({ type: 'session_init', resume, role });
        start();
        setStarted(true);
    };

    const handleStop = () => {
        stop();
        setStarted(false);
    };

    // Save Q&A to history
    React.useEffect(() => {
        if (answer && !isGenerating) {
            setHistory(prev => [
                { question: transcript, answer, ts: Date.now() },
                ...prev.slice(0, 9) // Keep last 10
            ]);
        }
    }, [isGenerating]);

    if (!started) {
        return (
            <SetupPanel
                resume={resume}
                setResume={setResume}
                role={role}
                setRole={setRole}
                onStart={handleStart}
                connected={connected}
            />
        );
    }

    return (
        <div className="app-container">
            <TranscriptBar
                transcript={transcript}
                isListening={isListening}
                onStop={handleStop}
            />
            <AnswerOverlay
                answer={answer}
                isGenerating={isGenerating}
                history={history}
            />
        </div>
    );
}