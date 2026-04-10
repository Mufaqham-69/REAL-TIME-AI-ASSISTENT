import React from 'react';

export default function TelemetryBar({ metrics, totalTime }) {
    return (
        <div className="telemetry-bar">
            <div className="telemetry-pipeline">
                <div className="telemetry-step finished">
                    <span className="step-label">AUDIO</span>
                    <span className="step-value">~{metrics.audio || 0}ms</span>
                </div>
                <div className="pipeline-arrow">→</div>
                
                <div className={`telemetry-step ${metrics.asr ? 'finished' : 'active'}`}>
                    <span className="step-label">ASR</span>
                    <span className="step-value">{metrics.asr || 0}ms</span>
                </div>
                <div className="pipeline-arrow">→</div>
                
                <div className={`telemetry-step ${metrics.llm ? 'finished' : (metrics.asr ? 'active' : 'idle')}`}>
                    <span className="step-label">LLM</span>
                    <span className="step-value">{metrics.llm || 0}ms</span>
                </div>
                <div className="pipeline-arrow">→</div>
                
                <div className={`telemetry-step ${metrics.display ? 'finished' : (metrics.llm ? 'active' : 'idle')}`}>
                    <span className="step-label">DISPLAY</span>
                    <span className="step-value">{metrics.display || 0}ms</span>
                </div>
            </div>
            
            {totalTime > 0 && (
                <div className="telemetry-total">
                    {totalTime}ms total
                </div>
            )}
        </div>
    );
}
