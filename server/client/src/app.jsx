import React, { useState, useRef, useCallback } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useWebSocket } from './hooks/useWebSocket';
import AnswerOverlay from './components/AnswerOverlay';
import TranscriptBar from './components/TranscriptBar';
import SetupPanel from './components/SetupPanel';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://real-time-ai-assistent-0.onrender.com';

export default function App() {
    const [started, setStarted] = useState(false);
    const [resume, setResume] = useState('');
    const [role, setRole] = useState('');
    const [history, setHistory] = useState([]);

    const { connected, transcript, answer, isGenerating, send, reset } =
        useWebSocket(WS_URL);

    // Send transcribed text directly to server
    const handleTranscript = useCallback(({ finalText, interimText }) => {
        if (finalText) {
            send({ type: 'client_transcript_final', text: finalText });
        } else if (interimText) {
            send({ type: 'client_transcript_partial', text: interimText });
        }
    }, [send]);

    const { start, stop, isListening } = useAudioCapture({
        onTranscript: handleTranscript,
    });

    const handleStart = () => {
        send({ type: 'session_init', resume, role });
        start();
        setStarted(true);
    };

    const handleStop = () => {
        stop();
        setStarted(false);
    };

    const handleRefresh = () => {
        setHistory([]);
        reset();
    };

    // Save Q&A to history
    React.useEffect(() => {
        if (answer && !isGenerating) {
            setHistory(prev => [
                { question: transcript, answer, ts: Date.now() },
                ...prev.slice(0, 9)
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
                onRefresh={handleRefresh}
            />
            <AnswerOverlay
                answer={answer}
                isGenerating={isGenerating}
                history={history}
            />
        </div>
    );
}