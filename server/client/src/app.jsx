import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useWebSpeech } from './hooks/useWebSpeech';
import { useWebSocket } from './hooks/useWebSocket';
import AnswerOverlay from './components/AnswerOverlay';
import TranscriptBar from './components/TranscriptBar';
import SetupPanel from './components/SetupPanel';
import TelemetryBar from './components/TelemetryBar';
import './app.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function App() {
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
    const [started, setStarted] = useState(false);
    const [resume, setResume] = useState('');
    const [role, setRole] = useState('');
    const [history, setHistory] = useState([]);
    const [asrError, setAsrError] = useState(null);
    const [manualInput, setManualInput] = useState('');

    const wasGeneratingRef = useRef(false);
    const lastQuestionRef = useRef('');

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

    // 1. Primary Audio Engine: Gemini Audio Stream (WAV 16kHz + VAD)
    // Works reliably in both Electron and any browser!
    const handleAudioChunk = useCallback((base64Data, durationMs) => {
        send({ type: 'audio_chunk', data: base64Data, durationMs });
    }, [send]);

    const { 
        start: startAudio, 
        stop: stopAudio, 
        flushNow: flushAudioNow, 
        isListening: isAudioListening, 
        isSpeaking, 
        audioLevel 
    } = useAudioCapture({
        onChunk: handleAudioChunk,
        onError: (err) => setAsrError(err)
    });

    // 2. Secondary interim speech recognition (Chrome only)
    const handlePartialText = useCallback((text) => {
        send({ type: 'text_partial', text });
    }, [send]);

    const handleFinalText = useCallback((text) => {
        if (!text || text.trim().length < 3) return;
        lastQuestionRef.current = text.trim();
        send({ type: 'text_question', text: text.trim() });
    }, [send]);

    const { start: startSpeech, stop: stopSpeech } = useWebSpeech({
        onPartialText: handlePartialText,
        onFinalText: handleFinalText,
        onError: () => {} // Silent fallback since Gemini Audio is primary
    });

    const handleStart = async () => {
        setAsrError(null);
        send({ type: 'session_init', resume, role });
        await startAudio();
        // Try WebSpeech in background if supported (Chrome)
        try { startSpeech(); } catch (_) {}
        setStarted(true);
    };

    const handleStop = () => {
        stopAudio();
        stopSpeech();
        setStarted(false);
    };

    const handleRefresh = () => {
        setHistory([]);
        setAsrError(null);
        setManualInput('');
        reset();
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualInput.trim() || isGenerating) return;
        const q = manualInput.trim();
        lastQuestionRef.current = q;
        send({ type: 'manual_trigger', text: q });
        setManualInput('');
    };

    // Save Q&A to history reliably when generation finishes
    useEffect(() => {
        if (wasGeneratingRef.current && !isGenerating && answer && !wsError) {
            const currentQ = lastQuestionRef.current || transcript || 'Question';
            setHistory(prev => [
                { question: currentQ, answer, ts: Date.now() },
                ...prev.slice(0, 9)
            ]);
        }
        wasGeneratingRef.current = isGenerating;
    }, [isGenerating, answer, wsError, transcript]);

    const [dismissBanner, setDismissBanner] = useState(false);

    if (!started) {
        return (
            <SetupPanel
                resume={resume}
                setResume={setResume}
                role={role}
                setRole={setRole}
                onStart={handleStart}
                connected={connected}
                isElectron={isElectron}
            />
        );
    }

    return (
        <div className="app-container">
            <TranscriptBar
                transcript={transcript}
                isListening={isAudioListening}
                onStop={handleStop}
                onRefresh={handleRefresh}
            />
            
            <main className="main-content">
                {/* Ghost Mode Status Banner - Dismissible */}
                {!dismissBanner && (
                    isElectron ? (
                        <div className="ghost-banner-active">
                            <span className="ghost-shield">🛡️</span>
                            <div className="ghost-text">
                                <strong>Ghost Mode Active:</strong> Invisible to Zoom, Teams, Meet & Slack screen sharing.
                            </div>
                            <button 
                                type="button" 
                                className="banner-dismiss-btn"
                                onClick={() => setDismissBanner(true)}
                                title="Dismiss banner"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="ghost-banner-web">
                            <span className="ghost-shield">⚠️</span>
                            <div className="ghost-text">
                                <strong>Browser Mode:</strong> Regular browsers are visible on screen share. For invisible ghost mode, run: <code>npm run electron</code>
                            </div>
                            <button 
                                type="button" 
                                className="banner-dismiss-btn"
                                onClick={() => setDismissBanner(true)}
                                title="Dismiss banner"
                            >
                                ✕
                            </button>
                        </div>
                    )
                )}

                <div className="telemetry-wrapper">
                    <TelemetryBar 
                        metrics={metrics} 
                        totalTime={totalTime} 
                    />
                    
                    {/* Visual Live Mic Meter & Status */}
                    {isAudioListening && (
                        <div className="audio-meter-container">
                            <div className="audio-meter-label">
                                {isSpeaking ? '🎤 Speaking:' : 'Live Mic:'}
                            </div>
                            <div className="audio-meter-track">
                                <div 
                                    className={`audio-meter-fill ${isSpeaking ? 'speaking' : ''}`}
                                    style={{ width: `${Math.max(audioLevel, 4)}%` }}
                                />
                            </div>
                            <span className="audio-level-pct">{audioLevel}%</span>
                            <button 
                                type="button"
                                onClick={flushAudioNow} 
                                className="flush-audio-btn" 
                                title="Click to immediately transcribe and answer what you just said without waiting for silence"
                            >
                                ⚡ Send Audio
                            </button>
                        </div>
                    )}
                </div>
                
                {asrError && (
                    <div className="asr-error-banner">
                        <span className="error-icon">⚠</span>
                        <span className="error-text">{asrError}</span>
                        <button type="button" onClick={handleStart} className="retry-btn">Retry Mic</button>
                    </div>
                )}
                
                <AnswerOverlay
                    answer={answer}
                    isGenerating={isGenerating}
                    history={history}
                    error={wsError}
                />

                {/* Quick Manual Question Bar */}
                <form onSubmit={handleManualSubmit} className="manual-prompt-bar">
                    <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Type interview question manually or speak into mic..."
                        disabled={isGenerating}
                    />
                    <button type="submit" disabled={!manualInput.trim() || isGenerating}>
                        {isGenerating ? 'Answering...' : 'Ask'}
                    </button>
                </form>
            </main>
        </div>
    );
}