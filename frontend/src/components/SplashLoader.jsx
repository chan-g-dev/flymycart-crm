import React, { useState, useEffect, useRef } from 'react';
import { FlyMyCartLogo } from './FlyMyCartLogo';
import { ShieldCheck, Zap, Database, CheckCircle2, Lock } from 'lucide-react';

export const SplashLoader = ({ syncStep = 'Initializing System Modules...', isComplete = false }) => {
    const [progress, setProgress] = useState(12);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const progressRef = useRef(12);

    const steps = [
        { label: 'Single-Entry DB & Invoices Initialized', icon: <Database size={13} color="#60a5fa" /> },
        { label: 'Prepaid & Postpaid Provider Wallets Connected', icon: <Zap size={13} color="#fbbf24" /> },
        { label: 'Role-Based Access Control (RBAC) & Center Security Active', icon: <ShieldCheck size={13} color="#34d399" /> },
        { label: 'Synchronizing Live Shipments & AWB Ledger...', icon: <CheckCircle2 size={13} color="#38bdf8" /> }
    ];

    useEffect(() => {
        if (isComplete) {
            setProgress(100);
            setActiveStepIndex(steps.length - 1);
            return;
        }

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return 95;
                const next = prev + (prev < 40 ? 12 : (prev < 75 ? 8 : 4));
                const clamped = Math.min(next, 95);
                progressRef.current = clamped;
                return clamped;
            });
        }, 60);

        const stepTimer = setInterval(() => {
            setActiveStepIndex(prev => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 160);

        return () => {
            clearInterval(interval);
            clearInterval(stepTimer);
        };
    }, [isComplete]);

    return (
        <div className="fmc-splash-overlay">
            {/* Ambient Background Glows */}
            <div className="fmc-splash-ambient-glow-1"></div>
            <div className="fmc-splash-ambient-glow-2"></div>

            <div className="fmc-splash-luxury-card">
                {/* 1. Top Brand Logo & Glowing Halo */}
                <div className="fmc-splash-hero-brand">
                    <div className="fmc-splash-halo-ring"></div>
                    <div className="fmc-splash-halo-ring-2"></div>
                    <FlyMyCartLogo height={44} width={210} theme="dark" />
                </div>

                <div className="fmc-splash-headline">
                    <h2 className="fmc-splash-app-name">Fly My Cart CRM</h2>
                    <p className="fmc-splash-sub-caption">
                        Courier Logistics & Single-Entry Financial Operating System
                    </p>
                </div>

                {/* 2. Cybernetic Neon Progress Track */}
                <div className="fmc-splash-meter-box">
                    <div className="fmc-splash-meter-header">
                        <span className="fmc-splash-meter-status">
                            <span className="fmc-pulse-dot"></span>
                            {progress >= 100 ? '✓ System Ready' : syncStep}
                        </span>
                        <span className="fmc-splash-meter-pct">{progress}%</span>
                    </div>

                    <div className="fmc-splash-track">
                        <div 
                            className="fmc-splash-fill" 
                            style={{ width: `${progress}%`, transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        >
                            <div className="fmc-splash-fill-glow"></div>
                        </div>
                    </div>
                </div>

                {/* 3. Real-time Micro-Sync Pipeline Steps */}
                <div className="fmc-splash-steps-list">
                    {steps.map((s, idx) => (
                        <div 
                            key={s.label} 
                            className={`fmc-splash-step-row ${idx <= activeStepIndex ? 'completed' : 'pending'}`}
                        >
                            <div className="fmc-splash-step-icon">
                                {s.icon}
                            </div>
                            <span className="fmc-splash-step-text">{s.label}</span>
                            {idx <= activeStepIndex && (
                                <span className="fmc-splash-check-badge">✓</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* 4. Enterprise Security & Integrity Badges */}
                <div className="fmc-splash-security-footer">
                    <div className="fmc-splash-badge-chip">
                        <Lock size={10} color="#94a3b8" />
                        <span>TLS 256-Bit Encrypted</span>
                    </div>
                    <div className="fmc-splash-badge-chip">
                        <Zap size={10} color="#10b981" />
                        <span>Single-Entry Integrity</span>
                    </div>
                    <div className="fmc-splash-badge-chip">
                        <span>v2.4 Enterprise</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplashLoader;
