import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import BranchHandshakeForm from './BranchHandshakeForm';
import ThemeSwitcher from './common/ThemeSwitcher';
import { SchoolIcon } from './icons/SchoolIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

type AuthView = 'login' | 'signup' | 'forgot' | 'handshake';
type GatewayMode = 'selection' | 'global' | 'branch';

const AuthPage: React.FC = () => {
    const [gatewayMode, setGatewayMode] = useState<GatewayMode>('selection'); // 'selection' is default
    const [authView, setAuthView] = useState<AuthView>('login');
    const [signupSuccess, setSignupSuccess] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    const handleSignupSuccess = (email: string) => {
        setUserEmail(email);
        setSignupSuccess(true);
    };

    const GatewaySelection = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-4"
        >
            {/* Option 1: Global Node (School) */}
            <div
                onClick={() => { setGatewayMode('global'); setAuthView('login'); }}
                className="group relative bg-[#0c0d12] hover:bg-[#111318] border border-white/5 hover:border-primary/30 rounded-[2.5rem] p-12 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 overflow-hidden flex flex-col justify-center items-center text-center min-h-[400px]"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
                    <SchoolIcon className="w-8 h-8 text-primary" />
                </div>

                <h3 className="text-3xl font-serif font-black text-white mb-4 uppercase tracking-tight">Establish <br />Global Node.</h3>
                <p className="text-white/40 text-sm font-serif italic leading-relaxed max-w-xs">
                    Initialize a head office and set up global academic infrastructure for your institution.
                </p>

                <div className="mt-10 px-8 py-3 rounded-full border border-white/10 group-hover:bg-primary group-hover:border-primary group-hover:text-white text-white/30 text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                    Initialize Protocol
                </div>
            </div>

            {/* Option 2: Institutional Hub (Branch) */}
            <div
                onClick={() => { setGatewayMode('branch'); setAuthView('handshake'); }}
                className="group relative bg-[#0c0d12] hover:bg-[#111318] border border-white/5 hover:border-emerald-500/30 rounded-[2.5rem] p-12 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/5 overflow-hidden flex flex-col justify-center items-center text-center min-h-[400px]"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <ShieldCheckIcon className="w-8 h-8 text-emerald-500" />
                </div>

                <h3 className="text-3xl font-serif font-black text-white mb-4 uppercase tracking-tight">Join <br />Institutional Hub.</h3>
                <p className="text-white/40 text-sm font-serif italic leading-relaxed max-w-xs">
                    Enter your unique <span className="text-emerald-500 not-italic font-bold">Branch Access Key</span> to synchronize with an established network.
                </p>

                <div className="mt-10 px-8 py-3 rounded-full border border-white/10 group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-[#08090a] text-white/30 text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                    Access Satellite Node
                </div>
            </div>
        </motion.div>
    );

    return (
        <div className="min-h-screen flex bg-[#08090a] selection:bg-primary/20 selection:text-primary overflow-hidden relative font-sans">
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
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
            </div>

            {/* Main Content Area */}
            <div className="w-full flex flex-col relative overflow-y-auto bg-transparent custom-scrollbar h-screen z-20">
                {/* Header / Top Bar */}
                <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
                    <ThemeSwitcher />
                </div>

                <div className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12 relative">

                    {/* Common Logo/Header (Visible when selecting or in specific persistent modes) */}
                    <div className="mb-12 text-center">
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <SchoolIcon className="h-10 w-10 text-primary" />
                            <span className="text-3xl font-serif font-black tracking-[0.3em] text-white uppercase">Gurukul</span>
                        </div>
                        {gatewayMode === 'selection' && (
                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="text-white/40 text-sm font-serif italic tracking-widest uppercase"
                            >
                                Select Interface Protocol
                            </motion.p>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {gatewayMode === 'selection' && (
                            <GatewaySelection key="selection" />
                        )}

                        {gatewayMode === 'global' && (
                            <motion.div
                                key="global"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full max-w-[480px]"
                            >
                                {signupSuccess ? (
                                    <div className="bg-[#0d0f14]/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[3.5rem] border border-white/10 text-center shadow-3xl relative overflow-hidden ring-1 ring-white/5">
                                        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-500/20">
                                            <CheckCircleIcon className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-3xl font-serif font-black text-white mb-4 tracking-tighter uppercase leading-none">Identity Provisioned.</h3>
                                        <p className="text-white/50 mb-10 text-sm leading-relaxed font-serif italic">
                                            Your node has been initialized. A verification cipher has been dispatched to <strong className="text-white">{userEmail}</strong>.
                                        </p>
                                        <button
                                            onClick={() => { setSignupSuccess(false); setAuthView('login'); }}
                                            className="w-full py-4 rounded-2xl text-[10px] font-black text-white bg-primary hover:bg-primary/90 transition-all uppercase tracking-[0.4em]"
                                        >
                                            Return to Terminal
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {authView === 'login' && <LoginForm onSwitchToSignup={() => setAuthView('signup')} onForgotPassword={() => setAuthView('forgot')} />}
                                        {authView === 'signup' && <SignupForm onSuccess={handleSignupSuccess} onSwitchToLogin={() => setAuthView('login')} />}
                                        {authView === 'forgot' && <ForgotPasswordForm onBack={() => setAuthView('login')} />}

                                        <div className="text-center mt-8">
                                            <button onClick={() => setGatewayMode('selection')} className="text-white/20 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
                                                ← Return to Gateway Selection
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {gatewayMode === 'branch' && (
                            <div className="w-full max-w-[540px]">
                                <BranchHandshakeForm
                                    onBack={() => setGatewayMode('selection')}
                                    onSuccess={() => { }} // Handled inside via reload usually
                                />
                            </div>
                        )}
                    </AnimatePresence>

                    <div className="absolute bottom-6 text-[9px] text-white/5 font-black uppercase tracking-[0.5em]">
                        &copy; 2025 Gurukul OS • Protocol Node 9.5.1
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
