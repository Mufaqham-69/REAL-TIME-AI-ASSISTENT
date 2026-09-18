import React, { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SetupPanel({ resume, setResume, role, setRole, onStart, connected, isElectron }) {
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
                // Direct client read for text files
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
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileProcess(files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleClearFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="setup-panel">
            <h1>🎙️ Real-Time AI Interview Assistant</h1>
            <div className="setup-status-row">
                <span className="status">{connected ? '🟢 Server Online' : '🔴 Connecting to server...'}</span>
                {isElectron ? (
                    <span className="ghost-pill-active">🛡️ Ghost Mode Active</span>
                ) : (
                    <span className="ghost-pill-hint" title="Run 'npm run electron' to hide overlay from screen shares">
                        🌐 Web Browser Mode
                    </span>
                )}
            </div>

            {isElectron ? (
                <div className="setup-ghost-notice">
                    🛡️ <strong>Anti-Screen Share is ON:</strong> This window will remain visible on your monitor but is <strong>100% invisible to interviewers</strong> on Zoom, Teams, Google Meet, and Slack screen sharing.
                </div>
            ) : (
                <div className="setup-browser-notice">
                    💡 <strong>Screen Share Notice:</strong> You are currently in Google Chrome. For <strong>100% invisible overlay</strong> during live screen shares, launch the desktop app with: <code>npm run electron</code>
                </div>
            )}

            <div className="field">
                <label>Target Role</label>
                <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Senior Software Engineer at Google"
                />
            </div>

            {/* Resume File Upload Dropzone */}
            <div className="field">
                <div className="field-label-row">
                    <label>Resume / Background Data</label>
                    {uploadedFile && (
                        <span className="uploaded-badge">
                            ✓ {uploadedFile.name} ({uploadedFile.words} words)
                            <button type="button" onClick={handleClearFile} className="clear-file-btn" title="Clear file selection">✕</button>
                        </span>
                    )}
                </div>

                <div 
                    className={`resume-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
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
                        <div className="dropzone-content">
                            <span className="spinner-icon">⏳</span>
                            <span>Extracting and parsing resume data...</span>
                        </div>
                    ) : (
                        <div className="dropzone-content">
                            <span className="dropzone-icon">📄</span>
                            <div className="dropzone-text">
                                <strong>Click to upload or drag & drop your Resume</strong>
                                <span className="dropzone-sub">Supports PDF, TXT, or Markdown documents</span>
                            </div>
                        </div>
                    )}
                </div>

                {uploadError && (
                    <div className="upload-error-text">
                        ⚠ {uploadError}
                    </div>
                )}
            </div>

            <div className="field">
                <label>Candidate Context (Parsed points & custom notes)</label>
                <textarea
                    value={resume}
                    onChange={e => setResume(e.target.value)}
                    rows={6}
                    placeholder={`e.g.
• 5+ years building full-stack applications with React & Node.js
• Led architecture of real-time distributed microservices
• Improved system throughput by 40% using event-driven design
• MS Computer Science`}
                />
            </div>

            <button
                onClick={onStart}
                disabled={!connected || uploading}
                className="start-btn"
            >
                {connected ? 'Start Live Interview Session' : 'Connecting to Server...'}
            </button>
        </div>
    );
}
