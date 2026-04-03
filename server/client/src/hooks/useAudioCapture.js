import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 16000;
const CHUNK_MS = 250; // Send audio every 250ms

export function useAudioCapture({ onChunk, onSilence }) {
  const [isListening, setIsListening] = useState(false);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const silenceTimerRef = useRef(null);

  const start = useCallback(async () => {
    try {
      // Capture system audio + mic (user selects during permission prompt)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor for raw PCM chunks (or use AudioWorklet for production)
      const bufferSize = Math.floor(SAMPLE_RATE * CHUNK_MS / 1000);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let buffer = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        buffer.push(...input);

        // Check for silence (RMS < threshold)
        const rms = Math.sqrt(input.reduce((s, v) => s + v * v, 0) / input.length);

        if (rms < 0.01) {
          // Silence detected
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              onSilence?.();
              buffer = [];
              silenceTimerRef.current = null;
            }, 800); // 800ms silence = end of question
          }
        } else {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (buffer.length >= bufferSize) {
          // Convert Float32 PCM → Int16 → base64
          const int16 = new Int16Array(buffer.splice(0, bufferSize).map(s =>
            Math.max(-32768, Math.min(32767, s * 32768))
          ));
          const bytes = new Uint8Array(int16.buffer);
          const b64 = btoa(String.fromCharCode(...bytes));
          onChunk?.(b64);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsListening(true);

    } catch (err) {
      console.error('Audio capture failed:', err);
    }
  }, [onChunk, onSilence]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    clearTimeout(silenceTimerRef.current);
    setIsListening(false);
  }, []);

  return { start, stop, isListening };
}