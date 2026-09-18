import React, { useState, useEffect } from 'react';

export default function TranscriptBar({ transcript, isListening, onStop, onRefresh }) {
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
    const [isGhostProtected, setIsGhostProtected] = useState(true);

    useEffect(() => {
        if (window.electronAPI?.onProtectionChanged) {
            const cleanup = window.electronAPI.onProtectionChanged((status) => {
                setIsGhostProtected(status);
            });
            return cleanup;
        }
    }, []);

    const toggleProtection = () => {
        const newState = !isGhostProtected;
        setIsGhostProtected(newState);
        if (window.electronAPI?.setProtection) {
            window.electronAPI.setProtection(newState);
        }
    };

    const handleHide = () => {
        if (window.electronAPI?.hideWindow) {
            window.electronAPI.hideWindow();
        }
    };

    return (
        <div className="transcript-bar" style={{ WebkitAppRegion: 'drag' }}>
            <div className="transcript-info" style={{ WebkitAppRegion: 'no-drag' }}>
                <span className={`mic-dot ${isListening ? 'active' : ''}`} />
                <span className="transcript-text">
                    {transcript || (isListening ? 'Listening for speech...' : 'Mic Standby')}
                </span>
            </div>

            <div className="bar-actions" style={{ WebkitAppRegion: 'no-drag' }}>
                {isElectron ? (
                    <>
                        <button 
                            onClick={toggleProtection} 
                            className="ghost-toggle-btn"
                            style={{ 
                                background: isGhostProtected ? 'linear-gradient(135deg, #10b981, #059669)' : '#ef4444',
                                color: '#fff'
                            }}
                            title={isGhostProtected 
                                ? "Ghost Mode ACTIVE: This window is INVISIBLE to Zoom, Teams, Meet & Slack screen sharing!" 
                                : "Ghost Mode DISABLED: Window is visible to screen share"}
                        >
                            {isGhostProtected ? '🛡️ Ghost: Hidden from Share' : '⚠️ Ghost: Off (Visible)'}
                        </button>
                        <button 
                            onClick={handleHide} 
                            className="refresh-btn"
                            title="Hide window (Press Ctrl+Shift+H to bring back)"
                        >
                            _ Hide
                        </button>
                    </>
                ) : (
                    <span className="browser-mode-tag" title="Screen protection requires the Electron app">
                        🌐 Web Mode
                    </span>
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