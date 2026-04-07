import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 0.015;    // RMS below this = silence
const SILENCE_DURATION_MS = 900;    // ms of silence before triggering
const MIN_CHUNK_DURATION_MS = 1500; // Don't send chunks shorter than this
const MAX_CHUNK_DURATION_MS = 8000; // Force-send if question goes this long

export function useAudioCapture({ onChunk, onSilence }) {
  const [isListening, setIsListening] = useState(false);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  // Accumulate raw PCM samples here
  const pcmBufferRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const chunkStartRef = useRef(null);

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
    if (durationMs < MIN_CHUNK_DURATION_MS) {
      console.log(`[Audio] Skipping short chunk: ${Math.round(durationMs)}ms`);
      pcmBufferRef.current = [];
      return;
    }

    console.log(`[Audio] Flushing ${Math.round(durationMs)}ms of audio (reason: ${reason})`);

    // Convert Float32[] to Int16Array
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }

    // Build WAV file in memory
    const wavBuffer = buildWav(int16, SAMPLE_RATE);

    // Send as base64
    const base64 = arrayBufferToBase64(wavBuffer);
    onChunk?.(base64, durationMs);

    // Reset
    pcmBufferRef.current = [];
    chunkStartRef.current = Date.now();

    if (reason === 'silence') {
      onSilence?.();
    }
  }, [onChunk, onSilence]);

  const start = useCallback(async () => {
    try {
      console.log('[Audio] Requesting microphone access...');

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

      console.log('[Audio] Microphone granted:', stream.getAudioTracks()[0].label);

      streamRef.current = stream;
      pcmBufferRef.current = [];
      chunkStartRef.current = Date.now();

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessor (compatible) with 4096 buffer
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);

        // Calculate RMS to detect speech vs silence
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          sumSq += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSq / input.length);

        // Push samples to buffer (copy the array, not a reference!)
        pcmBufferRef.current.push(...Array.from(input));

        const elapsed = Date.now() - chunkStartRef.current;

        if (rms > SILENCE_THRESHOLD) {
          // Active speech - cancel any pending silence trigger
          clearSilenceTimer();

          // Force flush if question is too long
          if (elapsed > MAX_CHUNK_DURATION_MS) {
            flushBuffer('max_duration');
          }
        } else {
          // Silence - start countdown if not already running
          if (!silenceTimerRef.current && elapsed > MIN_CHUNK_DURATION_MS) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              flushBuffer('silence');
            }, SILENCE_DURATION_MS);
          }
        }
      };

      source.connect(processor);
      // NOTE: Must connect to destination or onaudioprocess won't fire in some browsers
      processor.connect(audioCtx.destination);

      setIsListening(true);
      console.log('[Audio] Listening started');

    } catch (err) {
      console.error('[Audio] Failed to start:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone in browser settings and reload.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and reload.');
      } else {
        alert('Audio error: ' + err.message);
      }
    }
  }, [flushBuffer]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    flushBuffer('stopped'); // Send any remaining audio

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();

    pcmBufferRef.current = [];
    setIsListening(false);
    console.log('[Audio] Stopped');
  }, [flushBuffer]);

  return { start, stop, isListening };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWav(int16Samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = int16Samples.length * 2; // 2 bytes per Int16 sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);   // File size minus 8 bytes
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);             // Sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true);              // Audio format: PCM = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
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
  // Process in chunks to avoid call stack overflow
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}