import React, { useState } from 'react';

// Formats bullet points and bold markers cleanly into structured cards
function renderMarkdownBold(str) {
    if (!str) return null;
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="highlight-text">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

function FormattedModelAnswer({ text }) {
    if (!text) return null;
    
    // Split bullet points
    const rawPoints = text
        .split(/(?:^|\n)\s*[•\-\*]\s+/)
        .map(p => p.trim())
        .filter(Boolean);

    if (rawPoints.length <= 1) {
        return (
            <div className="answer-text-fallback">
                {renderMarkdownBold(text)}
            </div>
        );
    }

    return (
        <div className="answer-points-grid">
            {rawPoints.map((pt, i) => {
                const match = pt.match(/^\*?\*?([^:*]+)\*?\*?:\s*(.*)/s);
                const title = match ? match[1].replace(/\*/g, '').trim() : `Talking Point ${i + 1}`;
                const content = match ? match[2].trim() : pt;

                const getIcon = (t) => {
                    const l = t.toLowerCase();
                    if (l.includes('approach') || l.includes('strategy') || l.includes('core')) return '🎯';
                    if (l.includes('exec') || l.includes('arch') || l.includes('implement')) return '⚙️';
                    if (l.includes('impact') || l.includes('result') || l.includes('metric')) return '📈';
                    return '💡';
                };

                return (
                    <div key={i} className="answer-point-card">
                        <div className="point-card-header">
                            <span className="point-card-icon">{getIcon(title)}</span>
                            <span className="point-card-title">{title}</span>
                        </div>
                        <div className="point-card-body">
                            {renderMarkdownBold(content)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function RecruiterPrepPanel({ 
    prepData, 
    role, 
    onStartLive, 
    onBackToSetup, 
    onPracticeQuestion,
    onRegenerate,
    isRegenerating 
}) {
    const [expandedId, setExpandedId] = useState(prepData?.questions?.[0]?.id || 1);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [copiedId, setCopiedId] = useState(null);

    const questions = prepData?.questions || [];
    
    // Extract unique categories with counts
    const uniqueCats = [...new Set(questions.map(q => q.category).filter(Boolean))];
    const categoryOptions = [
        { key: 'ALL', label: `All Questions (${questions.length})` },
        ...uniqueCats.map(cat => ({
            key: cat,
            label: `${cat} (${questions.filter(q => q.category === cat).length})`
        }))
    ];

    const filteredQuestions = selectedCategory === 'ALL' 
        ? questions 
        : questions.filter(q => q.category === selectedCategory);

    const handleCopy = (id, text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const getCategoryClass = (cat) => {
        const lower = (cat || '').toLowerCase();
        if (lower.includes('tech')) return 'badge-cat-tech';
        if (lower.includes('behavioral') || lower.includes('star')) return 'badge-cat-behavioral';
        if (lower.includes('cross') || lower.includes('exam')) return 'badge-cat-exam';
        return 'badge-cat-default';
    };

    const getDifficultyClass = (diff) => {
        const lower = (diff || '').toLowerCase();
        if (lower.includes('hard') || lower.includes('expert')) return 'badge-diff-hard';
        if (lower.includes('medium')) return 'badge-diff-medium';
        return 'badge-diff-easy';
    };

    return (
        <div className="recruiter-panel-wrapper">
            {/* 1. Header / Assessment Summary */}
            <div className="recruiter-hero glass-panel">
                <div className="recruiter-badge-row">
                    <div className="badge-group-left">
                        <span className="recruiter-badge">
                            👔 Senior Bar-Raiser Assessment
                        </span>
                        <span className="question-count-badge">
                            {questions.length} Custom Questions Curated
                        </span>
                    </div>
                    <span className="role-target-pill">
                        Targeting: <strong>{role || 'Senior Technical Role'}</strong>
                    </span>
                </div>

                <h1 className="recruiter-title">
                    Resume Intelligence & Recruiter Drill
                </h1>

                {prepData?.summary && (
                    <div className="recruiter-summary-box">
                        <div className="recruiter-summary-label">
                            <span className="summary-icon">🔍</span>
                            <span>Executive Recruiter Evaluation:</span>
                        </div>
                        <p className="recruiter-summary-text">{prepData.summary}</p>
                    </div>
                )}
            </div>

            {/* 2. Equal Aligned Filter Bar */}
            <div className="recruiter-filter-bar glass-panel">
                <span className="filter-label">Filter Category:</span>
                <div className="filter-pills">
                    {categoryOptions.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`filter-pill-btn ${selectedCategory === key ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Questions List with Equal Formatting */}
            <div className="questions-accordion">
                {filteredQuestions.length === 0 ? (
                    <div className="no-questions-placeholder glass-panel">
                        No questions found under this filter.
                    </div>
                ) : (
                    filteredQuestions.map((q, index) => {
                        const isExpanded = expandedId === q.id;
                        const questionNumber = String(index + 1).padStart(2, '0');

                        return (
                            <div 
                                key={q.id} 
                                className={`question-card-item glass-panel ${isExpanded ? 'is-expanded' : ''}`}
                            >
                                <div 
                                    className="question-card-header"
                                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                                >
                                    <div className="question-header-content">
                                        <div className="question-top-meta">
                                            <span className="question-index-chip">Q{questionNumber}</span>
                                            <span className={`cat-pill ${getCategoryClass(q.category)}`}>
                                                {q.category}
                                            </span>
                                            {q.difficulty && (
                                                <span className={`diff-pill ${getDifficultyClass(q.difficulty)}`}>
                                                    {q.difficulty}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="question-title-text">{q.question}</h2>
                                    </div>
                                    <div className={`question-toggle-icon ${isExpanded ? 'expanded' : ''}`}>
                                        <span className="toggle-chevron">▼</span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="question-card-body">
                                        {/* What Recruiter Looks For */}
                                        {q.whatRecruiterLooksFor && (
                                            <div className="recruiter-intent-box">
                                                <div className="intent-title">
                                                    🎯 Recruiter Evaluation Motive:
                                                </div>
                                                <div className="intent-desc">
                                                    {q.whatRecruiterLooksFor}
                                                </div>
                                            </div>
                                        )}

                                        {/* Structured Talking Points Model Answer */}
                                        <div className="model-answer-section">
                                            <div className="model-answer-header">
                                                <div className="answer-heading-row">
                                                    <span className="answer-heading-icon">💡</span>
                                                    <span className="answer-heading">
                                                        Tailored Model Answer (Speaking as You)
                                                    </span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    className="btn-copy-answer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(q.id, q.modelAnswer);
                                                    }}
                                                >
                                                    {copiedId === q.id ? '✓ Copied to Clipboard' : '📋 Copy Answer'}
                                                </button>
                                            </div>

                                            <div className="model-answer-wrapper">
                                                <FormattedModelAnswer text={q.modelAnswer} />
                                            </div>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="question-card-footer">
                                            <button
                                                type="button"
                                                className="btn-practice-trigger"
                                                onClick={() => onPracticeQuestion(q.question)}
                                                title="Send to Live Assistant for real-time speech coaching"
                                            >
                                                ⚡ Practice this Question in Live Copilot
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 4. Bottom Global Controls */}
            <div className="recruiter-footer-actions glass-panel">
                <div className="left-actions">
                    <button 
                        type="button"
                        className="btn-back-setup" 
                        onClick={onBackToSetup}
                    >
                        ← Back to Resume Edit
                    </button>
                    <button 
                        type="button"
                        className="btn-regenerate" 
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                    >
                        {isRegenerating ? '🔄 Analyzing Resume...' : '🔄 Re-analyze Resume'}
                    </button>
                </div>

                <button 
                    type="button"
                    className="btn-launch-live"
                    onClick={onStartLive}
                >
                    <span className="pulsing-live-dot"></span>
                    <span>🚀 Start Live Real-Time Copilot</span>
                </button>
            </div>
        </div>
    );
}
