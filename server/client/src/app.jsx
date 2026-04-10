import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSpeech } from './hooks/useWebSpeech';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioLevel } from './hooks/useAudioLevel';
import AnswerOverlay from './components/AnswerOverlay';
import TranscriptBar from './components/TranscriptBar';
import SetupPanel from './components/SetupPanel';
import TelemetryBar from './components/TelemetryBar';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function App() {
    const [started, setStarted] = useState(false);
    const [resume, setResume] = useState('');
    const [role, setRole] = useState('');
    const [history, setHistory] = useState([]);
    const [asrError, setAsrError] = useState(null);

    const { 
        connected, 
        transcript, 
        answer, 
        isGenerating, 
        send, 
        reset,
        metrics,
        totalTime,
        error: wsError
    } = useWebSocket(WS_URL);

    const handlePartialText = useCallback((text) => {
        send({ type: 'text_partial', text });
    }, [send]);

    const handleFinalText = useCallback((text) => {
        send({ type: 'text_question', text });
    }, [send]);

    const handleAsrError = useCallback((err) => {
        setAsrError(err);
    }, []);

    const { start, stop, isListening } = useWebSpeech({
        onPartialText: handlePartialText,
        onFinalText: handleFinalText,
        onError: handleAsrError
    });

    const audioLevel = useAudioLevel(isListening);

    const handleStart = () => {
        setAsrError(null);
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
        setAsrError(null);
        reset();
    };

    // Save Q&A to history
    useEffect(() => {
        if (answer && !isGenerating && !wsError && !asrError) {
            setHistory(prev => [
                { question: transcript, answer, ts: Date.now() },
                ...prev.slice(0, 9)
            ]);
        }
    }, [isGenerating, wsError, asrError]);

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
            
            <main className="main-content">
                <div className="telemetry-wrapper">
                    <TelemetryBar 
                        metrics={metrics} 
                        totalTime={totalTime} 
                    />
                    
                    {/* Visual Audio Meter */}
                    {isListening && (
                        <div className="audio-meter-container">
                            <div className="audio-meter-label">Live Mic:</div>
                            <div className="audio-meter-track">
                                <div 
                                    className="audio-meter-fill" 
                                    style={{ width: `${audioLevel}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
                
                {asrError && (
                    <div className="asr-error-banner">
                        <span className="error-icon">⚠</span>
                        <span className="error-text">Audio Error: {asrError}</span>
                        <button onClick={start} className="retry-btn">Restart Mic</button>
                    </div>
                )}
                
                <AnswerOverlay
                    answer={answer}
                    isGenerating={isGenerating}
                    history={history}
                    error={wsError}
                />
            </main>
        </div>
    );
}