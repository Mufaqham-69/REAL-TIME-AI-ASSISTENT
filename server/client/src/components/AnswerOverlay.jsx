import React, { useEffect, useRef } from 'react';

export default function AnswerOverlay({ answer, isGenerating, history }) {
    const answerRef = useRef(null);

    // Auto-scroll as tokens stream in
    useEffect(() => {
        if (answerRef.current) {
            answerRef.current.scrollTop = answerRef.current.scrollHeight;
        }
    }, [answer]);

    return (
        <div className="answer-panel">
            {/* Live answer */}
            <div className="answer-box" ref={answerRef}>
                {isGenerating && !answer && (
                    <span className="thinking">Generating answer...</span>
                )}
                {answer && (
                    <p className="answer-text">
                        {answer}
                        {isGenerating && <span className="cursor">▌</span>}
                    </p>
                )}
                {!answer && !isGenerating && (
                    <p className="placeholder">Listening for interview questions...</p>
                )}
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="history">
                    <h4>Previous Q&A</h4>
                    {history.map((item, i) => (
                        <div key={item.ts} className="history-item">
                            <p className="history-q">Q: {item.question}</p>
                            <p className="history-a">A: {item.answer}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}