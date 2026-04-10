import React, { useEffect, useRef } from 'react';

export default function AnswerOverlay({ answer, isGenerating, history, error }) {
    const answerRef = useRef(null);

    // Auto-scroll as tokens stream in
    useEffect(() => {
        if (answerRef.current) {
            answerRef.current.scrollTop = answerRef.current.scrollHeight;
        }
    }, [answer]);

    const tokenCount = answer ? answer.trim().split(/\s+/).length : 0;

    return (
        <div className="answer-panel">
            <div className="answer-box" ref={answerRef}>
                <div className="status-label">
                    {error ? '⚠ Error' : (isGenerating ? '✓ Generating' : (answer ? '✓ Answer Ready' : '• Standby'))}
                </div>
                
                {answer && (
                    <div className="tokens-count">
                        {tokenCount} tokens
                    </div>
                )}

                {error && (
                    <div className="error-display">
                        <p className="error-message">{error}</p>
                        <p className="error-hint">This usually happens due to API Rate Limits. Please wait 60 seconds and try again.</p>
                    </div>
                )}

                {isGenerating && !answer && !error && (
                    <div className="thinking">
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                    </div>
                )}
                
                {answer && (
                    <p className="answer-text">
                        {answer}
                        {isGenerating && <span className="cursor"></span>}
                    </p>
                )}
                
                {!answer && !isGenerating && !error && (
                    <p className="placeholder">Listening for interview questions...</p>
                )}
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="history">
                    <h4>Previous Sessions</h4>
                    {history.map((item, i) => (
                        <div key={item.ts} className="history-item">
                            <p className="history-q">{item.question}</p>
                            <p className="history-a">{item.answer}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}