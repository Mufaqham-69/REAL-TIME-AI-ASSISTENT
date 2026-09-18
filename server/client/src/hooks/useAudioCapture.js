import { useRef, useState, useCallback, useEffect } from 'react';

const SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 0.012;    // RMS threshold for human speech
const SILENCE_DURATION_MS = 800;    // ms of silence before auto-flushing speech
const MIN_CHUNK_DURATION_MS = 900;  // Minimum audio duration to process
const MAX_CHUNK_DURATION_MS = 9000; // Auto-flush long continuous questions

export function useAudioCapture({ onChunk, onSilence, onError }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const muteGainRef = useRef(null);

  const pcmBufferRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const chunkStartRef = useRef(null);
  const hadSpeechRef = useRef(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const flushBuffer = useCallback((reason = 'silence') => {
    const samples = pcmBufferRef.current;
    if (samples.length === 0) return;

    const durationMs = (samples.length / SAMPLE_RATE) * 1000;
    
    // If no human speech was detected during this chunk, drop it to save API calls
    if (!hadSpeechRef.current && reason === 'silence') {
      pcmBufferRef.current = [];
      setIsSpeaking(false);
      return;
    }

    if (durationMs < MIN_CHUNK_DURATION_MS) {
      pcmBufferRef.current = [];
      setIsSpeaking(false);
      return;
    }

    console.log(`[Audio] Sending ${Math.round(durationMs)}ms speech to ASR (reason: ${reason})`);

    // Convert Float32[] to Int16Array
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }

    // Build standard 16kHz Mono 16-bit PCM WAV
    const wavBuffer = buildWav(int16, SAMPLE_RATE);
    const base64 = arrayBufferToBase64(wavBuffer);
    
    onChunk?.(base64, durationMs);

    // Reset buffer for next question
    pcmBufferRef.current = [];
    chunkStartRef.current = Date.now();
    hadSpeechRef.current = false;
    setIsSpeaking(false);

    if (reason === 'silence') {
      onSilence?.();
    }
  }, [onChunk, onSilence]);

  const start = useCallback(async () => {
    try {
      console.log('[Audio] Starting microphone capture...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: SAMPLE_RATE },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;
      pcmBufferRef.current = [];
      chunkStartRef.current = Date.now();
      hadSpeechRef.current = false;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor with 4096 buffer size
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Mute Gain Node: Prevents microphone from looping back to speakers!
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      muteGainRef.current = muteGain;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);

        // Calculate RMS audio energy
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          sumSq += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSq / input.length);

        // Update visual audio meter (0-100)
        const currentLevel = Math.min(100, Math.round(rms * 450));
        setAudioLevel(currentLevel);

        // Push samples to PCM buffer
        pcmBufferRef.current.push(...Array.from(input));

        const elapsed = Date.now() - (chunkStartRef.current || Date.now());

        if (rms > SILENCE_THRESHOLD) {
          hadSpeechRef.current = true;
          setIsSpeaking(true);
          clearSilenceTimer();

          // Force flush if speech is longer than max limit
          if (elapsed > MAX_CHUNK_DURATION_MS) {
            flushBuffer('max_duration');
          }
        } else {
          // Silence detected
          if (hadSpeechRef.current && !silenceTimerRef.current && elapsed > MIN_CHUNK_DURATION_MS) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              flushBuffer('silence');
            }, SILENCE_DURATION_MS);
          }
        }
      };

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      setIsListening(true);
      console.log('[Audio] Microphone active and listening');

    } catch (err) {
      console.error('[Audio] Microphone access error:', err);
      onError?.(err.name === 'NotAllowedError' 
        ? 'Microphone permission denied. Please allow microphone access in browser settings.' 
        : `Microphone error: ${err.message}`);
    }
  }, [flushBuffer, onError]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    flushBuffer('stopped');

    processorRef.current?.disconnect();
    muteGainRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }

    pcmBufferRef.current = [];
    setIsListening(false);
    setIsSpeaking(false);
    setAudioLevel(0);
    console.log('[Audio] Microphone stopped');
  }, [flushBuffer]);

  const flushNow = useCallback(() => {
    flushBuffer('manual');
  }, [flushBuffer]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, flushNow, isListening, isSpeaking, audioLevel };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWav(int16Samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = int16Samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < int16Samples.length; i++) {
    view.setInt16(offset, int16Samples[i], true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}