import React, { useState } from 'react';

export default function TelemetryBar({ metrics = {}, totalTime = 0 }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="telemetry-compact-container">
            <div className="telemetry-strip" onClick={() => setExpanded(prev => !prev)} title="Click to toggle pipeline telemetry">
                <span className="telemetry-pulse-icon">⚡</span>
                <div className="telemetry-chips">
                    <span className="tele-chip finished">
                        <small>AUDIO</small> <strong>~{metrics.audio || 0}ms</strong>
                    </span>
                    <span className="tele-arrow">→</span>
                    <span className={`tele-chip ${metrics.asr ? 'finished' : 'active'}`}>
                        <small>ASR</small> <strong>{metrics.asr || 0}ms</strong>
                    </span>
                    <span className="tele-arrow">→</span>
                    <span className={`tele-chip ${metrics.llm ? 'finished' : (metrics.asr ? 'active' : 'idle')}`}>
                        <small>LLM</small> <strong>{metrics.llm || 0}ms</strong>
                    </span>
                    <span className="tele-arrow">→</span>
                    <span className={`tele-chip ${metrics.display ? 'finished' : (metrics.llm ? 'active' : 'idle')}`}>
                        <small>UI</small> <strong>{metrics.display || 0}ms</strong>
                    </span>
                </div>

                {totalTime > 0 && (
                    <span className="telemetry-total-badge">
                        {totalTime}ms
                    </span>
                )}
            </div>
        </div>
    );
}
