import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ThemeSwitcher from './common/ThemeSwitcher';
import { SchoolIcon } from './icons/SchoolIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

type AuthView = 'login' | 'signup' | 'forgot';

const AuthPage: React.FC = () => {
    const [view, setView] = useState<AuthView>('login');
    const [signupSuccess, setSignupSuccess] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    const handleSignupSuccess = (email: string) => {
        setUserEmail(email);
        setSignupSuccess(true);
    };

    return (
        <div className="min-h-screen flex bg-[#030304] selection:bg-primary/30 selection:text-white overflow-hidden relative font-sans">
            {/* Atmospheric Background Layers */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/carbon-fibre.png")` }}></div>
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.15, 0.1],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none"
                ></motion.div>
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.05, 0.1, 0.05],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"
                ></motion.div>
            </div>

            {/* Left Column: Institutional Branding (Desktop Only) */}
            <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-[#050508] border-r border-white/5 shadow-2xl z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-40"></div>

                {/* Ambient glow for branding exposure */}
                <div className="absolute -bottom-20 -left-20 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[160px] opacity-30"></div>

                <div className="relative z-20 flex flex-col justify-between w-full p-20 xl:p-24 2xl:p-32 text-white h-full">
                    <div className="flex items-center gap-6 group">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full opacity-30 group-hover:opacity-100 transition-opacity duration-1000"></div>
                            <div className="relative p-5 bg-white/5 rounded-[1.5rem] backdrop-blur-3xl border border-white/10 shadow-3xl transition-all group-hover:scale-105 group-hover:-rotate-2 duration-700">
                                <SchoolIcon className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-sans font-bold tracking-wider text-white">Universepi</span>
                        </div>
                    </div>

                    <div className="max-w-2xl mt-12 mb-auto self-center lg:self-start">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <h1 className="text-4xl sm:text-5xl font-sans font-bold leading-tight mb-6 tracking-tight text-white">
                                Welcome to <br />
                                <span className="text-white/40 font-light block pr-4">Universepi.</span>
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="relative"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent"></div>
                            <p className="text-lg xl:text-xl text-text-tertiary leading-relaxed font-sans max-w-lg pl-6">
                                Manage your school operations in one <span className="text-white">unified platform</span>.
                            </p>
                        </motion.div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-[10px] text-white/15 font-black uppercase tracking-[0.6em] flex items-center gap-4">
                            <span>&copy; 2026 Universepi OS</span>
                            <span className="w-1.5 h-px bg-white/10"></span>
                            <span>Version 9.7.2</span>
                        </div>
                        <div className="flex gap-8 opacity-20 hover:opacity-100 transition-opacity duration-500">
                            {/* Visual cues for institutional reliability */}
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black uppercase tracking-tighter">Verified</span>
                                <span className="text-[12px] font-serif italic">Institutional Grade</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Authentication */}
            <div className="w-full lg:w-[40%] flex flex-col relative overflow-y-auto bg-bg-obsidian custom-scrollbar h-screen z-20 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]">
                <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Secure Connection</span>
                    </div>
                    <ThemeSwitcher />
                </div>

                <div className="flex-grow flex items-center justify-center p-6 sm:p-12 lg:p-20 relative">
                    <div className="w-full max-w-[480px] z-10 relative">
                        <AnimatePresence mode="wait">
                            {signupSuccess ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-[#0d0f14]/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[3.5rem] border border-white/10 text-center shadow-3xl relative overflow-hidden ring-1 ring-white/5"
                                >
                                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-500/20">
                                        <CheckCircleIcon animate className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-3xl font-sans font-bold text-white mb-4 tracking-tight">Account Created</h3>
                                    <p className="text-white/50 mb-10 text-base leading-relaxed font-sans">
                                        Your account has been successfully created. A verification email has been sent to <strong className="text-white">{userEmail}</strong>.
                                    </p>
                                    <button
                                        onClick={() => { setSignupSuccess(false); setView('login'); }}
                                        className="w-full h-12 flex items-center justify-center py-3 px-6 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all transform active:scale-95 shadow-md hover:shadow-lg"
                                    >
                                        Sign In
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={view}
                                    initial={{ opacity: 0, x: view === 'login' ? -20 : 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: view === 'login' ? 20 : -20 }}
                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                    className="w-full"
                                >
                                    {view === 'login' && (
                                        <LoginForm
                                            onSwitchToSignup={() => setView('signup')}
                                            onForgotPassword={() => setView('forgot')}
                                        />
                                    )}
                                    {view === 'signup' && (
                                        <SignupForm
                                            onSuccess={handleSignupSuccess}
                                            onSwitchToLogin={() => setView('login')}
                                        />
                                    )}
                                    {view === 'forgot' && (
                                        <ForgotPasswordForm
                                            onBack={() => setView('login')}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
