import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSpeech({ onPartialText, onFinalText, onError }) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const shouldListenRef = useRef(false);
    const lastResultTimerRef = useRef(null);
    const isListeningRef = useRef(false);

    // Keep callbacks up to date in refs to avoid recreating recognition on render
    const callbacksRef = useRef({ onPartialText, onFinalText, onError });
    useEffect(() => {
        callbacksRef.current = { onPartialText, onFinalText, onError };
    }, [onPartialText, onFinalText, onError]);

    const resetWatchdog = useCallback(() => {
        if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
        
        // If we don't hear anything for 25s while supposed to be listening, soft restart
        lastResultTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && isListeningRef.current && recognitionRef.current) {
                console.warn('[WebSpeech] Watchdog: Silence timeout. Refreshing recognition...');
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    try { recognitionRef.current.abort(); } catch (_) {}
                }
            }
        }, 25000);
    }, []);

    useEffect(() => {
        const SpeechRecognition = typeof window !== 'undefined' 
            ? (window.SpeechRecognition || window.webkitSpeechRecognition) 
            : null;

        if (!SpeechRecognition) {
            console.error('[WebSpeech] Web Speech API is not supported in this browser.');
            callbacksRef.current.onError?.('Web Speech API is not supported in this browser. Please use Google Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('[WebSpeech] Started listening');
            setIsListening(true);
            isListeningRef.current = true;
            resetWatchdog();
        };

        recognition.onresult = (event) => {
            resetWatchdog();
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcriptPiece = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) {
                    finalTranscript += transcriptPiece;
                } else {
                    interimTranscript += transcriptPiece;
                }
            }

            if (interimTranscript && callbacksRef.current.onPartialText) {
                callbacksRef.current.onPartialText(interimTranscript);
            }
            if (finalTranscript && callbacksRef.current.onFinalText) {
                callbacksRef.current.onFinalText(finalTranscript.trim());
            }
        };

        recognition.onerror = (event) => {
            console.warn('[WebSpeech] Recognition error:', event.error);
            if (event.error === 'not-allowed') {
                shouldListenRef.current = false;
                setIsListening(false);
                isListeningRef.current = false;
                callbacksRef.current.onError?.('Microphone access denied. Please grant permission in browser settings.');
            } else if (event.error === 'network') {
                console.warn('[WebSpeech] Network error during recognition. Will retry automatically.');
            }
            // Note: 'no-speech' is normal when user is quiet
        };

        recognition.onend = () => {
            console.log('[WebSpeech] Recognition ended');
            setIsListening(false);
            isListeningRef.current = false;
            if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
            
            // Auto-restart if we should still be listening
            if (shouldListenRef.current) {
                setTimeout(() => {
                    if (shouldListenRef.current && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            // If already started or transitioning, ignore
                        }
                    }
                }, 200);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            shouldListenRef.current = false;
            isListeningRef.current = false;
            if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
            try {
                recognition.abort();
            } catch (_) {}
            recognitionRef.current = null;
        };
    }, [resetWatchdog]);

    const start = useCallback(() => {
        shouldListenRef.current = true;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (err) {
                // If recognition is already started, don't throw
                console.log('[WebSpeech] Start notice:', err.message);
            }
        }
    }, []);

    const stop = useCallback(() => {
        shouldListenRef.current = false;
        if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_) {}
        }
        setIsListening(false);
        isListeningRef.current = false;
    }, []);

    return { start, stop, isListening };
}
