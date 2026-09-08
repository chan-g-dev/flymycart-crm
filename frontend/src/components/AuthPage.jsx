import React, { useState } from 'react';
import { Lock, Mail, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FlyMyCartLogo } from './FlyMyCartLogo';
import { ButtonSpinner } from './LoadingSpinner';
import { navigate } from '../utils/navigation';

export const AuthPage = ({ onLoginSuccess }) => {
    const { login } = useAuth();

    // Login state
    const [loginFullName, setLoginFullName] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLoginSubmit = async (e) => {
        e?.preventDefault();
        setErrorMessage('');

        const fullName = loginFullName.trim();
        const identifier = loginEmail.trim();
        if (!fullName || !identifier || !loginPassword) {
            setErrorMessage('Please fill in all mandatory fields: Full Name, Email, and Password.');
            return;
        }

        setIsSubmitting(true);
        try {
            await login(identifier, loginPassword, fullName);
            if (onLoginSuccess) {
                onLoginSuccess();
            }
            navigate('/', true);
        } catch (err) {
            setErrorMessage(err.message || 'Invalid credentials.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 16px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}>
            {/* Card Container */}
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden'
            }}>
                {/* Brand Header */}
                <div style={{ 
                    padding: '18px 24px 10px', 
                    textAlign: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#ffffff'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                        <FlyMyCartLogo height={36} theme="light" />
                    </div>
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '17px', 
                        fontWeight: 800, 
                        color: '#0f172a',
                        letterSpacing: '-0.3px'
                    }}>
                        CRM Staff Login
                    </h2>
                    <p style={{ 
                        margin: '3px 0 0', 
                        fontSize: '12px', 
                        color: '#64748b' 
                    }}>
                        Enter your credentials to access the system
                    </p>
                </div>

                {/* Form Body */}
                <div style={{ padding: '14px 24px 14px' }}>
                    {errorMessage && (
                        <div style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '12px',
                            color: '#b91c1c'
                        }}>
                            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ lineHeight: '1.4' }}>{errorMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                        {/* 1. Full Name (Mandatory) */}
                        <div>
                            <label style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px', 
                                fontWeight: 700, 
                                color: '#334155', 
                                marginBottom: '4px' 
                            }}>
                                <span>Full Name</span>
                                <span style={{ color: '#ef4444', fontWeight: 800 }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '12px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <User size={16} />
                                </div>
                                <input
                                    id="login-fullname"
                                    type="text"
                                    value={loginFullName}
                                    onChange={(e) => setLoginFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                    required
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 38px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13.5px',
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.15s ease'
                                    }}
                                />
                            </div>
                        </div>

                        {/* 2. Email (Mandatory) */}
                        <div>
                            <label style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px', 
                                fontWeight: 700, 
                                color: '#334155', 
                                marginBottom: '4px' 
                            }}>
                                <span>Email</span>
                                <span style={{ color: '#ef4444', fontWeight: 800 }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '12px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <Mail size={16} />
                                </div>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 38px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13.5px',
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.15s ease'
                                    }}
                                />
                            </div>
                        </div>

                        {/* 3. Password (Mandatory) */}
                        <div>
                            <label style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px', 
                                fontWeight: 700, 
                                color: '#334155', 
                                marginBottom: '4px' 
                            }}>
                                <span>Password</span>
                                <span style={{ color: '#ef4444', fontWeight: 800 }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '12px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <Lock size={16} />
                                </div>
                                <input
                                    id="login-password"
                                    type={showLoginPassword ? 'text' : 'password'}
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 40px 10px 38px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13.5px',
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.15s ease'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="btn-login"
                            type="submit"
                            disabled={isSubmitting}
                            style={{
                                marginTop: '2px',
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#1e64f0',
                                color: '#ffffff',
                                fontSize: '13.5px',
                                fontWeight: 700,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(30, 100, 240, 0.25)',
                                transition: 'background 0.2s ease, transform 0.1s ease'
                            }}
                        >
                            {isSubmitting ? (
                                <ButtonSpinner text="Signing in..." />
                            ) : (
                                <>
                                    <span>Sign In to CRM</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer note */}
                <div style={{
                    padding: '7px 16px',
                    background: '#f8fafc',
                    borderTop: '1px solid #f1f5f9',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#94a3b8',
                    letterSpacing: '0.1px'
                }}>
                    Protected Enterprise System &bull; Fly My Cart CRM
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
