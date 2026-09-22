import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useWebSpeech } from './hooks/useWebSpeech';
import { useWebSocket } from './hooks/useWebSocket';
import AnswerOverlay from './components/AnswerOverlay';
import TranscriptBar from './components/TranscriptBar';
import SetupPanel from './components/SetupPanel';
import TelemetryBar from './components/TelemetryBar';
import LoginPage from './components/LoginPage';
import RecruiterPrepPanel from './components/RecruiterPrepPanel';
import './app.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
    
    // Web Authentication State (persisted in localStorage)
    const [user, setUser] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('interview_assistant_user');
                if (saved) return JSON.parse(saved);
            } catch (_) {}
        }
        return isElectron ? { name: 'Desktop User', email: 'desktop@local', role: 'Engineer' } : null;
    });

    const [started, setStarted] = useState(false);
    const [resume, setResume] = useState('');
    const [role, setRole] = useState(() => user?.role || '');
    const [history, setHistory] = useState([]);
    const [asrError, setAsrError] = useState(null);
    const [manualInput, setManualInput] = useState('');

    // Senior Recruiter Q&A State
    const [recruiterPrepData, setRecruiterPrepData] = useState(null);
    const [isAnalyzingRecruiter, setIsAnalyzingRecruiter] = useState(false);
    const [recruiterError, setRecruiterError] = useState(null);
    const [showRecruiterPrep, setShowRecruiterPrep] = useState(false);

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

    const handleLogin = (userData) => {
        setUser(userData);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('interview_assistant_user', JSON.stringify(userData));
            } catch (_) {}
        }
        if (userData.role && !role) {
            setRole(userData.role);
        }
    };

    const handleLogout = () => {
        setUser(null);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('interview_assistant_user');
            } catch (_) {}
        }
        setStarted(false);
        setShowRecruiterPrep(false);
    };

    // Trigger Senior Recruiter Deep Analysis on uploaded resume
    const handleAnalyzeRecruiter = async () => {
        if (!resume || resume.trim().length < 20) {
            setRecruiterError('Please upload or paste your resume experience first.');
            return;
        }

        setIsAnalyzingRecruiter(true);
        setRecruiterError(null);

        try {
            const url = API_BASE ? `${API_BASE}/api/recruiter-prep` : '/api/recruiter-prep';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume, role })
            });

            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (_) {
                if (rawText.includes('<!DOCTYPE') || rawText.includes('Cannot POST')) {
                    throw new Error('The backend server was not updated with the new route. Please restart the backend server.');
                }
                throw new Error(`Server returned non-JSON response: ${rawText.slice(0, 100)}`);
            }

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate senior recruiter analysis.');
            }

            setRecruiterPrepData(data);
            setShowRecruiterPrep(true);
        } catch (err) {
            console.error('Recruiter analysis error:', err);
            setRecruiterError(err.message);
        } finally {
            setIsAnalyzingRecruiter(false);
        }
    };

    // 1. Primary Audio Engine: Gemini Audio Stream (WAV 16kHz + VAD)
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

    // Practice a recruiter question immediately in Live mode
    const handlePracticeQuestion = async (questionText) => {
        setShowRecruiterPrep(false);
        await handleStart();
        // Trigger question after connection initializes
        setTimeout(() => {
            lastQuestionRef.current = questionText;
            send({ type: 'manual_trigger', text: questionText });
        }, 400);
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

    // Gate 1: Web Mode Authentication Gate
    if (!user && !isElectron) {
        return <LoginPage onLogin={handleLogin} />;
    }

    // Gate 2: Setup or Recruiter Prep before Live Session
    if (!started) {
        if (showRecruiterPrep && recruiterPrepData) {
            return (
                <div className="recruiter-page-container">
                    <RecruiterPrepPanel
                        prepData={recruiterPrepData}
                        role={role}
                        onStartLive={async () => {
                            setShowRecruiterPrep(false);
                            await handleStart();
                        }}
                        onBackToSetup={() => setShowRecruiterPrep(false)}
                        onPracticeQuestion={handlePracticeQuestion}
                        onRegenerate={handleAnalyzeRecruiter}
                        isRegenerating={isAnalyzingRecruiter}
                    />
                </div>
            );
        }

        return (
            <SetupPanel
                resume={resume}
                setResume={setResume}
                role={role}
                setRole={setRole}
                onStart={handleStart}
                connected={connected}
                isElectron={isElectron}
                user={user}
                onLogout={handleLogout}
                onAnalyzeRecruiter={handleAnalyzeRecruiter}
                isAnalyzingRecruiter={isAnalyzingRecruiter}
                recruiterError={recruiterError}
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