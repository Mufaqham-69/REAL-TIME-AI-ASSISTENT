import React from 'react';

export default function SetupPanel({ resume, setResume, role, setRole, onStart, connected }) {
    return (
        <div className="setup-panel">
            <h1>🎙️ Interview Assistant</h1>
            <p className="status">{connected ? '🟢 Server connected' : '🔴 Connecting to server...'}</p>

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
• 5+ years building full-stack applications with React & Node.js
• Led architecture of real-time distributed microservices
• Improved system throughput by 40% using event-driven design
• MS Computer Science`}
                />
            </div>

            <button
                onClick={onStart}
                disabled={!connected}
                className="start-btn"
            >
                {connected ? 'Start Live Assistant' : 'Connecting to Server...'}
            </button>
        </div>
    );
}
