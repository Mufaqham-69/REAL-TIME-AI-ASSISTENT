import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        const name = email.split('@')[0];
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
        onLogin({
            email: email.trim(),
            name: formattedName,
            isGuest: false
        });
    };

    const handleGuestLogin = () => {
        onLogin({
            email: 'guest@interview-ai.com',
            name: 'Demo Candidate',
            isGuest: true
        });
    };

    return (
        <div className="login-wrapper">
            <div className="login-backdrop-glow"></div>
            
            <div className="login-card glass-panel">
                <div className="login-brand">
                    <div className="brand-badge-pill">
                        <span className="pulsing-dot"></span>
                        Web Mode
                    </div>
                    <h1 className="brand-title">
                        Real-Time <span className="text-gradient">AI Assistant</span>
                    </h1>
                    <p className="brand-subtitle">
                        Sign in to access your interview workspace and recruiter coaching.
                    </p>
                </div>

                {error && <div className="login-error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="login-email">Email Address</label>
                        <div className="input-wrapper">
                            <span className="input-icon">✉️</span>
                            <input 
                                id="login-email"
                                type="email" 
                                required 
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="login-password">Password</label>
                        <div className="input-wrapper">
                            <span className="input-icon">🔒</span>
                            <input 
                                id="login-password"
                                type="password" 
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-btn-primary">
                        Sign In & Continue →
                    </button>
                </form>

                <div className="login-divider">
                    <span>or</span>
                </div>

                <button 
                    type="button" 
                    onClick={handleGuestLogin} 
                    className="login-btn-guest"
                >
                    ⚡ Instant Guest / Demo Access
                </button>
            </div>
        </div>
    );
}
