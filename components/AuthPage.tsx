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
                            <span className="text-2xl font-serif font-black tracking-[0.3em] text-white uppercase opacity-100">Universepi</span>
                            <span className="text-[10px] font-black tracking-[0.5em] text-primary/60 uppercase -mt-1 ml-1">OS Registry</span>
                        </div>
                    </div>

                    <div className="max-w-2xl mt-12 mb-auto self-center lg:self-start">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <h1 className="text-[5rem] xl:text-[7rem] 2xl:text-[8.5rem] font-serif font-black leading-[0.9] mb-12 tracking-[-0.03em] uppercase text-white">
                                Unified <br />
                                <span className="text-white/40 italic font-light tracking-[-0.05em] block translate-x-12">Identity.</span>
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="relative"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent"></div>
                            <p className="text-xl xl:text-2xl text-text-tertiary leading-relaxed font-serif italic max-w-lg pl-12 tracking-tight">
                                The high-fidelity administrative operating system for <span className="text-white">next-generation institutional orchestration</span>.
                            </p>
                        </motion.div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-[10px] text-white/15 font-black uppercase tracking-[0.6em] flex items-center gap-4">
                            <span>&copy; 2026 Universepi OS</span>
                            <span className="w-1.5 h-px bg-white/10"></span>
                            <span>Protocol Node 9.7.2</span>
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

            {/* Right Column: Auth Node */}
            <div className="w-full lg:w-[40%] flex flex-col relative overflow-y-auto bg-bg-obsidian custom-scrollbar h-screen z-20 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]">
                <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Protocol Secured</span>
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
                                    <h3 className="text-3xl font-serif font-black text-white mb-4 tracking-tighter uppercase leading-none">Identity Provisioned.</h3>
                                    <p className="text-white/50 mb-10 text-sm leading-relaxed font-serif italic">
                                        Your node has been initialized. A verification cipher has been dispatched to <strong className="text-white">{userEmail}</strong>.
                                    </p>
                                    <button
                                        onClick={() => { setSignupSuccess(false); setView('login'); }}
                                        className="w-full h-14 flex items-center justify-center py-3.5 px-8 rounded-2xl text-[10px] font-black text-white bg-primary hover:bg-primary/90 transition-all transform active:scale-95 uppercase tracking-[0.4em] shadow-xl shadow-primary/20"
                                    >
                                        Return to Terminal
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
