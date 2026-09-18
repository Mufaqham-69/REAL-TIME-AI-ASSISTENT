import React, { useState } from 'react';

const getElectron = () => {
    try {
        if (typeof window !== 'undefined' && typeof window.require === 'function') {
            return window.require('electron');
        }
    } catch (_) {}
    return null;
};

const electron = getElectron();

export default function TranscriptBar({ transcript, isListening, onStop, onRefresh }) {
    const [isHidden, setIsHidden] = useState(true);

    const toggleProtection = () => {
        const newState = !isHidden;
        setIsHidden(newState);
        if (electron?.ipcRenderer) {
            electron.ipcRenderer.send('toggle-protection', newState);
        }
    };

    return (
        <div className="transcript-bar">
            <div className="transcript-info">
                <span className={`mic-dot ${isListening ? 'active' : ''}`} />
                <span className="transcript-text">
                    {transcript || (isListening ? 'Listening for interviewer...' : 'Standby')}
                </span>
            </div>
            <div className="bar-actions">
                {electron && (
                    <button 
                        onClick={toggleProtection} 
                        className="refresh-btn"
                        style={{ backgroundColor: isHidden ? '#6d28d9' : '#334155' }}
                        title="Toggle anti-screen-share protection"
                    >
                        {isHidden ? '🙈 Hidden' : '👀 Visible'}
                    </button>
                )}
                <button onClick={onRefresh} className="refresh-btn" title="Reset Session">
                    ↻ Refresh
                </button>
                <button onClick={onStop} className="stop-btn" title="Back to setup">
                    ← Setup
                </button>
            </div>
        </div>
    );
}