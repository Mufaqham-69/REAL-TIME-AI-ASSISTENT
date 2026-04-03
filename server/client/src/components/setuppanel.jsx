import React from 'react';

export default function SetupPanel({ resume, setResume, role, setRole, onStart, connected }) {
    return (
        <div className="setup-panel">
            <h1>🎙️ Interview Assistant</h1>
            <p className="status">{connected ? '🟢 Server connected' : '🔴 Connecting...'}</p>

            <div className="field">
                <label>Target Role</label>
                <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Senior Software Engineer at Google"
                />
            </div>

            <div className="field">
                <label>Your Resume / Background (paste key points)</label>
                <textarea
                    value={resume}
                    onChange={e => setResume(e.target.value)}
                    rows={8}
                    placeholder={`e.g.
5 years React/Node.js experience
Led team of 4 engineers at Startup X
Built payment system processing $2M/day
MS Computer Science, Stanford`}
                />
            </div>

            <button
                onClick={onStart}
                disabled={!connected}
                className="start-btn"
            >
                Start Listening
            </button>
        </div>
    );
}