import React, { useEffect, useRef, useState, useMemo } from 'react';

// Formatter to convert raw streaming text into clean, separated talking point cards
function renderFormattedContent(rawText, isGenerating) {
    if (!rawText) return null;

    // Helper to format bold **terms** and highlight key metrics
    const formatInlineSpans = (text) => {
        // Split by markdown bold (**text**)
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={i} className="answer-bold-highlight">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return part;
        });
    };

    // Step 1: Normalize newlines and break into lines
    const rawLines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const cards = [];

    rawLines.forEach((line) => {
        // Check for markdown headers (### Topic)
        const headerMatch = line.match(/^(#{1,4})\s+(.+)/);
        if (headerMatch) {
            cards.push({
                type: 'header',
                text: headerMatch[2]
            });
            return;
        }

        // Check for explicit bullet or numbered list: "• ", "* ", "- ", "1. ", "Step 1: "
        const bulletMatch = line.match(/^([*•\-–▪▫]|(\d+\.))\s*(.+)/);
        if (bulletMatch) {
            cards.push({
                type: 'point',
                text: bulletMatch[3]
            });
            return;
        }

        // If it's a paragraph without explicit bullets:
        // If it's a long multi-sentence paragraph (> 160 chars), break it into readable thought blocks!
        if (line.length > 160 && /[.?!]\s+[A-Z0-9]/.test(line)) {
            // Split by sentence boundaries
            const sentences = line.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/).map(s => s.trim()).filter(Boolean);
            
            // Group sentences into 1-2 sentence digestible chunks
            let chunk = '';
            sentences.forEach((sent, idx) => {
                chunk = chunk ? `${chunk} ${sent}` : sent;
                if (chunk.length > 120 || idx === sentences.length - 1) {
                    cards.push({
                        type: 'point',
                        text: chunk
                    });
                    chunk = '';
                }
            });
            if (chunk) {
                cards.push({ type: 'point', text: chunk });
            }
        } else {
            // Normal paragraph or short thought
            cards.push({
                type: 'point',
                text: line
            });
        }
    });

    if (cards.length === 0) return null;

    let pointCounter = 1;

    return (
        <div className="answer-structured-flow">
            {cards.map((card, idx) => {
                const isLast = idx === cards.length - 1;

                if (card.type === 'header') {
                    return (
                        <div key={idx} className="answer-section-header">
                            <span className="header-tag">SECTION</span>
                            <h3 className="header-title">{formatInlineSpans(card.text)}</h3>
                        </div>
                    );
                }

                const currentPointNum = pointCounter++;
                const formattedNum = String(currentPointNum).padStart(2, '0');

                return (
                    <div key={idx} className="talking-point-card">
                        <div className="point-badge-column">
                            <span className="point-number-badge">
                                {formattedNum}
                            </span>
                        </div>
                        <div className="point-content-body">
                            <div className="point-text">
                                {formatInlineSpans(card.text)}
                                {isGenerating && isLast && <span className="cursor-stream" />}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function AnswerOverlay({ 
    answer, 
    isGenerating, 
    history = [], 
    error,
    onClearHistory 
}) {
    const answerRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: Normal, 1: Large, 2: Teleprompter
    const [highContrast, setHighContrast] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
    const [copiedHistoryId, setCopiedHistoryId] = useState(null);

    const fontClasses = ['font-normal', 'font-large', 'font-teleprompter'];

    // Handle user manual scrolling:
    // If the user scrolls up to read earlier points, do NOT yank them down!
    const handleScroll = () => {
        if (!answerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = answerRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        // If user is more than 50px away from bottom, pause auto-scroll
        if (distanceFromBottom > 50) {
            setIsAutoScrollPaused(true);
        } else {
            setIsAutoScrollPaused(false);
        }
    };

    // Auto-scroll as tokens stream in ONLY if user hasn't scrolled up
    useEffect(() => {
        if (answerRef.current && !isAutoScrollPaused) {
            answerRef.current.scrollTo({
                top: answerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [answer, isAutoScrollPaused]);

    // Reset auto-scroll lock when a new answer starts generating
    useEffect(() => {
        if (isGenerating) {
            setIsAutoScrollPaused(false);
        }
    }, [isGenerating]);

    const scrollToBottom = () => {
        setIsAutoScrollPaused(false);
        if (answerRef.current) {
            answerRef.current.scrollTo({
                top: answerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const scrollUp = () => {
        if (answerRef.current) {
            answerRef.current.scrollBy({ top: -180, behavior: 'smooth' });
        }
    };

    const scrollDown = () => {
        if (answerRef.current) {
            answerRef.current.scrollBy({ top: 180, behavior: 'smooth' });
        }
    };

    const wordCount = useMemo(() => {
        return answer ? answer.trim().split(/\s+/).filter(Boolean).length : 0;
    }, [answer]);

    const handleCopy = () => {
        if (!answer) return;
        navigator.clipboard.writeText(answer.replace(/\*\*/g, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyHistory = (text, id) => {
        navigator.clipboard.writeText(text.replace(/\*\*/g, ''));
        setCopiedHistoryId(id);
        setTimeout(() => setCopiedHistoryId(null), 2000);
    };

    const cycleFontSize = () => {
        setFontSizeLevel(prev => (prev + 1) % 3);
    };

    return (
        <div className={`answer-panel ${isFocusMode ? 'focus-mode-active' : ''}`}>
            <div 
                className={`answer-box ${fontClasses[fontSizeLevel]} ${highContrast ? 'high-contrast-mode' : ''}`} 
                ref={answerRef}
                onScroll={handleScroll}
            >
                {/* Header Controls Bar */}
                <div className="answer-box-header">
                    <div className="status-label-group">
                        {error ? (
                            <span className="status-badge error">⚠ Generation Error</span>
                        ) : isGenerating ? (
                            <span className="status-badge generating">
                                <span className="pulse-dot" /> Live Answering...
                            </span>
                        ) : answer ? (
                            <span className="status-badge ready">✓ Executive Answer Ready</span>
                        ) : (
                            <span className="status-badge standby">• Ready & Listening</span>
                        )}
                        
                        {answer && (
                            <span className="tokens-count">{wordCount} words</span>
                        )}
                    </div>

                    <div className="answer-actions-bar">
                        {/* Manual Scroll Step Buttons */}
                        <div className="scroll-btn-group" title="Scroll through answer">
                            <button type="button" onClick={scrollUp} className="tool-btn nav-btn" title="Scroll Up">
                                ▲
                            </button>
                            <button type="button" onClick={scrollDown} className="tool-btn nav-btn" title="Scroll Down">
                                ▼
                            </button>
                        </div>

                        {/* Font Size Toggle */}
                        <button 
                            type="button"
                            onClick={cycleFontSize} 
                            className="tool-btn" 
                            title="Cycle Text Size: Normal → Large → Teleprompter"
                        >
                            Text: {fontSizeLevel === 0 ? 'A' : (fontSizeLevel === 1 ? 'A+' : 'A++')}
                        </button>

                        {/* Contrast Toggle */}
                        <button 
                            type="button"
                            onClick={() => setHighContrast(prev => !prev)} 
                            className={`tool-btn ${highContrast ? 'active-contrast' : ''}`}
                            title="Toggle High-Contrast Reading Mode"
                        >
                            {highContrast ? '☀ Crisp' : '◐ Glass'}
                        </button>

                        {/* Focus / Teleprompter Mode Toggle */}
                        <button 
                            type="button"
                            onClick={() => setIsFocusMode(prev => !prev)} 
                            className={`tool-btn ${isFocusMode ? 'active-focus' : ''}`}
                            title="Toggle Full Focus / Teleprompter View"
                        >
                            {isFocusMode ? '🗗 Exit Focus' : '🗖 Focus'}
                        </button>

                        {/* History Drawer Toggle */}
                        {history.length > 0 && (
                            <button 
                                type="button"
                                onClick={() => setShowHistoryDrawer(true)} 
                                className="tool-btn history-pill-btn"
                                title="View previous answered questions"
                            >
                                📜 History ({history.length})
                            </button>
                        )}

                        {/* Copy Button */}
                        {answer && (
                            <button 
                                type="button"
                                onClick={handleCopy} 
                                className="tool-btn copy-btn"
                                title="Copy answer text"
                            >
                                {copied ? '✓ Copied' : '📋 Copy'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="error-display">
                        <p className="error-message">{error}</p>
                        <p className="error-hint">Please verify your API connection or ask again in a moment.</p>
                    </div>
                )}

                {/* Formulating Answer Animation */}
                {isGenerating && !answer && !error && (
                    <div className="thinking-container">
                        <span className="thinking-title">Formulating structured talking points</span>
                        <div className="thinking-dots">
                            <span className="dot dot-1" />
                            <span className="dot dot-2" />
                            <span className="dot dot-3" />
                        </div>
                    </div>
                )}
                
                {/* Structured Formatted Answer Content */}
                {answer ? (
                    renderFormattedContent(answer, isGenerating)
                ) : !isGenerating && !error && (
                    <div className="answer-empty-state">
                        <div className="empty-icon-glow">🎙️</div>
                        <p className="empty-title">Ready for interview question</p>
                        <p className="empty-subtitle">
                            Speak into your microphone or type a question below. The assistant will formulate separated, high-impact talking points instantly.
                        </p>
                    </div>
                )}

                {/* Floating "Scroll to Bottom" indicator when user scrolled up */}
                {isAutoScrollPaused && isGenerating && (
                    <button 
                        type="button" 
                        onClick={scrollToBottom} 
                        className="floating-scroll-bottom-btn"
                    >
                        ↓ Jump to latest talking point
                    </button>
                )}
            </div>

            {/* Slide-Out History Drawer (Does NOT squish the main answer!) */}
            {showHistoryDrawer && (
                <div className="history-drawer-backdrop" onClick={() => setShowHistoryDrawer(false)}>
                    <div className="history-drawer-panel" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="drawer-title-group">
                                <h3>📜 Interview Q&A History</h3>
                                <span className="drawer-count-badge">{history.length} saved</span>
                            </div>
                            <button 
                                type="button" 
                                className="drawer-close-btn" 
                                onClick={() => setShowHistoryDrawer(false)}
                                title="Close history"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="drawer-body">
                            {history.map((item, idx) => (
                                <div key={item.ts || idx} className="history-entry-card">
                                    <div className="history-question-header">
                                        <span className="q-chip">Q{history.length - idx}</span>
                                        <p className="q-text">{item.question}</p>
                                    </div>
                                    <div className="history-answer-body">
                                        {renderFormattedContent(item.answer, false)}
                                    </div>
                                    <div className="history-entry-footer">
                                        <button 
                                            type="button" 
                                            className="copy-mini-btn"
                                            onClick={() => handleCopyHistory(item.answer, item.ts || idx)}
                                        >
                                            {copiedHistoryId === (item.ts || idx) ? '✓ Copied' : '📋 Copy'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}