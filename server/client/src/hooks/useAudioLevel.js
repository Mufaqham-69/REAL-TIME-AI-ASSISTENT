import { useState, useEffect, useRef } from 'react';

export function useAudioLevel(isListening) {
    const [level, setLevel] = useState(0);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!isListening) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            setLevel(0);
            return;
        }

        async function setupAudio() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContext();
                audioContextRef.current = audioContext;

                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyserRef.current = analyser;

                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const updateLevel = () => {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    // Normalize to 0-100
                    setLevel(Math.min(100, Math.floor((average / 128) * 100)));
                    animationFrameRef.current = requestAnimationFrame(updateLevel);
                };

                updateLevel();
            } catch (err) {
                console.error('[AudioLevel] Error accessing microphone:', err);
                setLevel(0);
            }
        }

        setupAudio();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        };
    }, [isListening]);

    return level;
}
