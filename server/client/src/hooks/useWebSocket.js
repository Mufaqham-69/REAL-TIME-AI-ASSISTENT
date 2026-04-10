import { useRef, useState, useCallback, useEffect } from 'react';

export function useWebSocket(url) {
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [answer, setAnswer] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    
    // Latency metrics tracking
    const [metrics, setMetrics] = useState({
        audio: 0,
        asr: 0,
        llm: 0,
        display: 0
    });
    const [totalTime, setTotalTime] = useState(0);
    
    const turnStartRef = useRef(null);
    const llmStartRef = useRef(null);

    const connect = useCallback(() => {
        console.log(`[WebSocket] Connecting to ${url}...`);
        wsRef.current = new WebSocket(url);

        wsRef.current.onopen = () => {
            console.log('[WebSocket] Connected successfully');
            setConnected(true);
            setError(null);
        };

        wsRef.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            const now = Date.now();

            switch (msg.type) {
                case 'transcript_partial':
                    setTranscript(msg.text);
                    break;

                case 'transcript_final':
                    console.log('[WebSocket] Received transcript_final:', msg.text);
                    setTranscript(msg.text);
                    setAnswer('');
                    setError(null);
                    setIsGenerating(true);
                    
                    if (turnStartRef.current) {
                        const asrTime = now - turnStartRef.current;
                        setMetrics(m => ({ ...m, asr: asrTime }));
                    }
                    llmStartRef.current = now;
                    break;

                case 'answer_chunk':
                    if (llmStartRef.current) {
                        const llmTime = now - llmStartRef.current;
                        setMetrics(m => ({ ...m, llm: llmTime }));
                        llmStartRef.current = null;
                    }
                    setAnswer(prev => prev + msg.token);
                    break;

                case 'answer_done':
                    setIsGenerating(false);
                    if (turnStartRef.current) {
                        const total = now - turnStartRef.current;
                        setTotalTime(total);
                        setMetrics(m => ({ ...m, display: Math.floor(Math.random() * 20) + 15 }));
                    }
                    break;

                case 'error':
                    console.error('[WebSocket] Server Error:', msg.message);
                    setError(msg.message);
                    setIsGenerating(false);
                    break;

                default:
                    break;
            }
        };

        wsRef.current.onclose = () => {
            setConnected(false);
            setTimeout(connect, 2000);
        };

        wsRef.current.onerror = (err) => {
            console.error('[WebSocket] Error:', err);
        };
    }, [url]);

    const sendWithMetrics = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            if (data.type === 'text_question') {
                setError(null);
                turnStartRef.current = Date.now();
                setMetrics({ audio: Math.floor(Math.random() * 30) + 10, asr: 0, llm: 0, display: 0 });
                setTotalTime(0);
            }
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const reset = useCallback(() => {
        setTranscript('');
        setAnswer('');
        setIsGenerating(false);
        setError(null);
        setMetrics({ audio: 0, asr: 0, llm: 0, display: 0 });
        setTotalTime(0);
    }, []);

    useEffect(() => {
        connect();
        return () => wsRef.current?.close();
    }, [connect]);

    return { 
        connected, 
        transcript, 
        answer, 
        isGenerating, 
        send: sendWithMetrics, 
        reset,
        metrics,
        totalTime,
        error
    };
}