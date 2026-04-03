import React from 'react';

export default function TranscriptBar({ transcript, isListening, onStop }) {
    return (
        <div className="transcript-bar">
            <div className="left">
                <span className={`mic-dot ${isListening ? 'active' : ''}`} />
                <span className="transcript-text">
                    {transcript || 'Listening...'}
                </span>
            </div>
            <button onClick={onStop} className="stop-btn">■ Stop</button>
        </div>
    );
}