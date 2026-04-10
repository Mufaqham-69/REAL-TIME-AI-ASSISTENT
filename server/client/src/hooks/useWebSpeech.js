import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSpeech({ onPartialText, onFinalText, onError }) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const shouldListenRef = useRef(false);
    const lastResultTimerRef = useRef(null);

    const resetWatchdog = useCallback(() => {
        if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
        
        // If we don't hear anything for 20 seconds while waiting, try a hard reset
        lastResultTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && isListening) {
                console.warn('[WebSpeech] Watchdog: No speech detected for 20s. Restarting...');
                if (recognitionRef.current) {
                    try {
                        recognitionRef.current.stop();
                    } catch(e) {
                        recognitionRef.current.abort();
                    }
                }
            }
        }, 20000);
    }, [isListening]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Web Speech API is not supported in this browser.');
            onError?.('Browser not supported.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('[WebSpeech] Started');
            setIsListening(true);
            resetWatchdog();
        };

        recognition.onresult = (event) => {
            resetWatchdog(); // Got a result, reset timer
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript && onPartialText) onPartialText(interimTranscript);
            if (finalTranscript && onFinalText) onFinalText(finalTranscript.trim());
        };

        recognition.onerror = (event) => {
            console.error('[WebSpeech] Recognition error:', event.error);
            if (event.error === 'not-allowed') {
                shouldListenRef.current = false;
                setIsListening(false);
                onError?.('Microphone access denied.');
            }
        };

        recognition.onend = () => {
            console.log('[WebSpeech] Ended');
            setIsListening(false);
            if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
            
            if (shouldListenRef.current) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch(e) {
                        console.error('[WebSpeech] Restart failed', e);
                    }
                }, 150);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            shouldListenRef.current = false;
            if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current);
            recognition.abort();
        };
    }, [onPartialText, onFinalText, onError, resetWatchdog]);

    const start = useCallback(() => {
        shouldListenRef.current = true;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.warn('[WebSpeech] Start warning:', err.message);
            }
        }
    }, []);

    const stop = useCallback(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

    return { start, stop, isListening };
}
