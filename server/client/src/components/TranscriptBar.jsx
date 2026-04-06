import React, { useState } from 'react';

const electron = window.require ? window.require('electron') : null;

export default function TranscriptBar({ transcript, isListening, onStop }) {
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
                    >
                        {isHidden ? '🙈 Hidden' : '👀 Visible'}
                    </button>
                )}
                <button onClick={onStop} className="stop-btn">■ Stop</button>
            </div>
        </div>
    );
}