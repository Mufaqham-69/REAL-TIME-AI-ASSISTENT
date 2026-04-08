import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSpeech({ onPartialText, onFinalText }) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const shouldListenRef = useRef(false);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Web Speech API is not supported in this browser.');
            alert('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('[WebSpeech] Started listening');
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript && onPartialText) {
                onPartialText(interimTranscript);
            }

            if (finalTranscript && onFinalText) {
                onFinalText(finalTranscript.trim());
            }
        };

        recognition.onerror = (event) => {
            console.error('[WebSpeech] Error:', event.error);
        };

        recognition.onend = () => {
            console.log('[WebSpeech] Ended listening');
            setIsListening(false);
            
            // Auto-restart if we didn't explicitly call stop()
            // This handles the browser automatically terminating the session after a pause.
            if (shouldListenRef.current) {
                console.log('[WebSpeech] Auto-restarting...');
                try {
                    recognition.start();
                } catch(e) {
                    console.error('[WebSpeech] Auto-restart failed:', e);
                }
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                shouldListenRef.current = false;
                recognitionRef.current.abort();
            }
        };
    }, [onPartialText, onFinalText]);

    const start = useCallback(() => {
        shouldListenRef.current = true;
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.error('[WebSpeech] Could not start:', err);
            }
        }
    }, [isListening]);

    const stop = useCallback(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                setIsListening(false);
            } catch (err) {
                console.error('[WebSpeech] Could not stop:', err);
            }
        }
    }, []);

    return { start, stop, isListening };
}
