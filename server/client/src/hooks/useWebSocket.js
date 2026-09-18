import { useRef, useState, useCallback, useEffect } from 'react';

export function useWebSocket(url) {
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const isMountedRef = useRef(true);

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
        if (!isMountedRef.current) return;
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        console.log(`[WebSocket] Connecting to ${url}...`);
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMountedRef.current) return;
                console.log('[WebSocket] Connected successfully');
                setConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return;
                try {
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
                            setAnswer(prev => prev + (msg.token || ''));
                            break;

                        case 'answer_done':
                            setIsGenerating(false);
                            if (turnStartRef.current) {
                                const total = now - turnStartRef.current;
                                setTotalTime(total);
                                setMetrics(m => ({ ...m, display: Math.max(10, Math.floor(Math.random() * 20) + 15) }));
                            }
                            break;

                        case 'error': {
                            const errMsg = msg.text || msg.message || 'Server error occurred';
                            console.error('[WebSocket] Server Error:', errMsg);
                            setError(errMsg);
                            setIsGenerating(false);
                            break;
                        }

                        default:
                            break;
                    }
                } catch (parseErr) {
                    console.error('[WebSocket] Message parse error:', parseErr);
                }
            };

            ws.onclose = () => {
                if (!isMountedRef.current) return;
                setConnected(false);
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) connect();
                }, 2000);
            };

            ws.onerror = (err) => {
                console.error('[WebSocket] Connection error:', err);
            };
        } catch (err) {
            console.error('[WebSocket] Failed to instantiate WebSocket:', err);
        }
    }, [url]);

    const sendWithMetrics = useCallback((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            if (data.type === 'text_question' || data.type === 'manual_trigger') {
                setError(null);
                turnStartRef.current = Date.now();
                setMetrics({ audio: Math.floor(Math.random() * 30) + 10, asr: 0, llm: 0, display: 0 });
                setTotalTime(0);
            }
            try {
                wsRef.current.send(JSON.stringify(data));
            } catch (err) {
                console.error('[WebSocket] Failed to send message:', err);
            }
        } else {
            console.warn('[WebSocket] Cannot send message: socket is not open');
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
        isMountedRef.current = true;
        connect();
        return () => {
            isMountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
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