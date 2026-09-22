import React, { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SetupPanel({ 
    resume, 
    setResume, 
    role, 
    setRole, 
    onStart, 
    connected, 
    isElectron,
    user,
    onLogout,
    onAnalyzeRecruiter,
    isAnalyzingRecruiter,
    recruiterError
}) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileProcess = async (file) => {
        if (!file) return;
        setUploadError(null);
        setUploading(true);

        try {
            const fileName = file.name;
            const isText = fileName.endsWith('.txt') || fileName.endsWith('.md');
            
            if (isText) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    setResume(content);
                    const words = content.split(/\s+/).filter(Boolean).length;
                    setUploadedFile({ name: fileName, words });
                    setUploading(false);
                };
                reader.readAsText(file);
                return;
            }

            // Read binary for PDF / documents
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    const response = await fetch(`${API_BASE}/api/upload-resume`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName: file.name,
                            fileType: file.type,
                            fileData: base64Data
                        })
                    });

                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        throw new Error(data.error || 'Failed to extract text from file.');
                    }

                    setResume(data.text);
                    setUploadedFile({ name: data.fileName, words: data.wordCount });
                } catch (err) {
                    console.error('Upload error:', err);
                    setUploadError(`Failed to parse resume: ${err.message}`);
                } finally {
                    setUploading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setUploadError(err.message);
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileProcess(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleClearFile = (e) => {
        e.stopPropagation();
        setUploadedFile(null);
        setResume('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="setup-panel-wrapper">
            <div className="setup-card">
                {/* Header Row */}
                <header className="setup-header" style={{ WebkitAppRegion: 'drag' }}>
                    <div className="setup-title-area">
                        <div className="app-logo-box">🎙️</div>
                        <div className="setup-title-text">
                            <h1 className="app-title">Real-Time AI Interview Assistant</h1>
                            <span className="app-subtitle">Live In-Ear Co-Pilot & Question Responder</span>
                        </div>
                    </div>

                    <div className="setup-header-status" style={{ WebkitAppRegion: 'no-drag' }}>
                        {!isElectron && user && (
                            <div className="user-profile-badge">
                                <span className="user-avatar">👤</span>
                                <span className="user-name">{user.name}</span>
                                {onLogout && (
                                    <button 
                                        type="button" 
                                        onClick={onLogout} 
                                        className="btn-logout"
                                        title="Sign out of Web Mode"
                                    >
                                        Sign Out
                                    </button>
                                )}
                            </div>
                        )}
                        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}>
                            {connected ? '● Server Online' : '○ Connecting...'}
                        </span>
                        {isElectron ? (
                            <span className="ghost-badge active" title="Window excluded from screen captures">
                                🛡️ Ghost Protected
                            </span>
                        ) : (
                            <span className="ghost-badge web" title="Run electron for hidden screen-share mode">
                                🌐 Web Mode
                            </span>
                        )}
                    </div>
                </header>

                {/* Status Notice Capsule */}
                {isElectron ? (
                    <div className="setup-notice-bar electron">
                        <div className="notice-content">
                            <span className="notice-icon">🛡️</span>
                            <span><strong>Anti-Screen Share Active:</strong> Window is 100% invisible to Zoom, Meet, Teams & Slack viewers.</span>
                        </div>
                        <span className="hotkey-pill"><code>Ctrl+Shift+H</code> to hide/show</span>
                    </div>
                ) : (
                    <div className="setup-notice-bar web">
                        <div className="notice-content">
                            <span className="notice-icon">💡</span>
                            <span><strong>Browser Mode:</strong> Visible during screen sharing. Run <code>npm run electron</code> for invisible ghost overlay.</span>
                        </div>
                    </div>
                )}

                {/* 2-Column Responsive Workspace */}
                <div className="setup-main-grid">
                    {/* Left Column: Role & Upload */}
                    <div className="setup-col left-col">
                        <div className="field-group">
                            <label className="field-label">Target Role & Company</label>
                            <input
                                className="field-input"
                                value={role}
                                onChange={e => setRole(e.target.value)}
                                placeholder="e.g. Staff Full-Stack Engineer at Google"
                            />
                        </div>

                        <div className="field-group upload-group">
                            <div className="field-label-row">
                                <label className="field-label">Resume / Background</label>
                                {uploadedFile && (
                                    <span className="uploaded-chip">
                                        ✓ {uploadedFile.name} ({uploadedFile.words} words)
                                        <button 
                                            type="button" 
                                            onClick={handleClearFile} 
                                            className="chip-clear-btn" 
                                            title="Remove file"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                            </div>

                            <div 
                                className={`compact-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''} ${uploadedFile ? 'has-file' : ''}`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={(e) => handleFileProcess(e.target.files?.[0])}
                                    accept=".pdf,.txt,.md"
                                    style={{ display: 'none' }}
                                />
                                {uploading ? (
                                    <div className="dropzone-inner">
                                        <span className="spinner-icon">⏳</span>
                                        <div className="dropzone-meta">
                                            <strong>Extracting and parsing resume data...</strong>
                                            <span>Processing document structure</span>
                                        </div>
                                    </div>
                                ) : uploadedFile ? (
                                    <div className="dropzone-inner loaded">
                                        <span className="dropzone-icon">📄</span>
                                        <div className="dropzone-meta">
                                            <strong>{uploadedFile.name} loaded</strong>
                                            <span>Click or drag another file to replace</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="dropzone-inner">
                                        <span className="dropzone-icon">📁</span>
                                        <div className="dropzone-meta">
                                            <strong>Drop your Resume (PDF, TXT, MD)</strong>
                                            <span>or click to browse files from computer</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {uploadError && (
                                <div className="upload-error-pill">
                                    ⚠ {uploadError}
                                </div>
                            )}
                        </div>

                        {/* Shortcuts & Quick Info */}
                        <div className="setup-shortcuts-card">
                            <div className="shortcut-row">
                                <span className="sc-key">Ctrl+Shift+H</span>
                                <span className="sc-desc">Toggle overlay visibility instantly</span>
                            </div>
                            <div className="shortcut-row">
                                <span className="sc-key">Ctrl+Shift+G</span>
                                <span className="sc-desc">Toggle screen-share shield on/off</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Candidate Context */}
                    <div className="setup-col right-col">
                        <div className="field-group flex-fill-group">
                            <div className="field-label-row">
                                <label className="field-label">Candidate Experience & Talking Points</label>
                                {resume && (
                                    <button 
                                        type="button" 
                                        onClick={() => setResume('')} 
                                        className="text-clear-btn" 
                                        title="Clear context text"
                                    >
                                        Clear Text
                                    </button>
                                )}
                            </div>
                            <textarea
                                className="setup-textarea"
                                value={resume}
                                onChange={e => setResume(e.target.value)}
                                placeholder={`Enter key accomplishments, technologies, or notes to tailor answers:\n\n• 5+ years building scalable React & Node.js microservices\n• Architected real-time WebSocket pipelines handling 50k+ QPS\n• Led database optimization reducing latency by 45%\n• Strong expertise in Distributed Systems, System Design, Python`}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Action Footer */}
                <footer className="setup-footer">
                    {isElectron ? (
                        /* Ghost / Electron Mode: 100% Original Untouched Button */
                        <button
                            type="button"
                            onClick={onStart}
                            disabled={!connected || uploading}
                            className="start-session-btn"
                        >
                            {connected ? '🚀 Start Live Interview Session' : 'Connecting to Server...'}
                        </button>
                    ) : (
                        /* Web Mode: Senior Recruiter Analysis & Live Session */
                        <>
                            {recruiterError && (
                                <div className="recruiter-error-alert">
                                    ⚠ {recruiterError}
                                </div>
                            )}
                            
                            <div className="setup-footer-buttons">
                                <button
                                    type="button"
                                    onClick={onAnalyzeRecruiter}
                                    disabled={!connected || uploading || isAnalyzingRecruiter || !resume.trim()}
                                    className={`btn-recruiter-analyze ${resume.trim() ? 'ready' : ''}`}
                                    title={!resume.trim() ? 'Upload or paste your resume first' : 'Generate questions and model answers as a Senior Recruiter'}
                                >
                                    {isAnalyzingRecruiter ? (
                                        <>
                                            <span className="spinner-inline"></span>
                                            <span>Recruiter Bar-Raiser Analyzing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>👔 Analyze as Senior Recruiter</span>
                                            <span className="badge-tag">Questions + Answers</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={onStart}
                                    disabled={!connected || uploading || isAnalyzingRecruiter}
                                    className="start-session-btn"
                                >
                                    {connected ? '🚀 Start Live Interview Session' : 'Connecting to Server...'}
                                </button>
                            </div>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
}
