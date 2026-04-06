import { useRef, useState, useCallback, useEffect } from 'react';

export function useWebSocket(url) {
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [answer, setAnswer] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const connect = useCallback(() => {
        wsRef.current = new WebSocket(url);

        wsRef.current.onopen = () => {
            console.log('WebSocket connected');
            setConnected(true);
        };

        wsRef.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
                case 'transcript_partial':
                    setTranscript(msg.text);
                    break;

                case 'transcript_final':
                    setTranscript(msg.text);
                    setAnswer('');
                    setIsGenerating(true);
                    break;

                case 'answer_chunk':
                    // Stream tokens into answer
                    setAnswer(prev => prev + msg.token);
                    break;

                case 'answer_done':
                    setIsGenerating(false);
                    break;

                case 'error':
                    console.error('Server error:', msg.message);
                    setIsGenerating(false);
                    break;

                default:
                    break;
            }
        };

        wsRef.current.onclose = () => {
            setConnected(false);
            // Auto-reconnect after 2s
            setTimeout(connect, 2000);
        };

        wsRef.current.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }, [url]);

    const send = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const reset = useCallback(() => {
        setTranscript('');
        setAnswer('');
        setIsGenerating(false);
    }, []);

    useEffect(() => {
        connect();
        return () => wsRef.current?.close();
    }, [connect]);

    return { connected, transcript, answer, isGenerating, send, reset };
}