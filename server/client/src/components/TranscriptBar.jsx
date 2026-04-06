import React, { useState } from 'react';

const electron = window.require ? window.require('electron') : null;

export default function TranscriptBar({ transcript, isListening, onStop, onRefresh }) {
    const [isHidden, setIsHidden] = useState(true);

    const toggleProtection = () => {
        const newState = !isHidden;
        setIsHidden(newState);
        if (electron) {
            electron.ipcRenderer.send('toggle-protection', newState);
        }
    };

    return (
        <div className="transcript-bar">
            <div className="left">
                <span className={`mic-dot ${isListening ? 'active' : ''}`} />
                <span className="transcript-text">
                    {transcript || 'Listening...'}
                </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                {electron && (
                    <button 
                        onClick={toggleProtection} 
                        className="stop-btn"
                        style={{ backgroundColor: isHidden ? '#8e44ad' : '#555' }}
                        title="Toggle visibility during screen share"
                    >
                        {isHidden ? '🙈 Hidden' : '👀 Visible'}
                    </button>
                )}
                <button onClick={onRefresh} className="stop-btn" style={{ backgroundColor: '#2980b9' }} title="Reset Conversation">
                    ↻ Refresh
                </button>
                <button onClick={onStop} className="stop-btn" title="Go back to setup menu">
                    ← Back
                </button>
            </div>
        </div>
    );
}