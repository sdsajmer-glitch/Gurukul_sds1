import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ThemeSwitcher from './common/ThemeSwitcher';
import { SchoolIcon } from './icons/SchoolIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { MailIcon } from './icons/MailIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { PlusIcon } from './icons/PlusIcon';
import { BarChartIcon } from './icons/BarChartIcon';

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
        <div className="min-h-screen bg-[#030304] selection:bg-primary/30 selection:text-white font-sans text-white overflow-x-hidden">
            {/* 0. NAVIGATION PANEL */}
            <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-[#030304]/80 backdrop-blur-xl px-6 lg:px-12 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative p-2 bg-white/5 rounded-lg border border-white/10 group-hover:scale-105 transition-transform">
                            <SchoolIcon className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                    <span className="text-sm font-bold tracking-tight">Universepi</span>
                </div>

                <div className="hidden md:flex items-center gap-10">
                    {['Home', 'Features', 'Modules', 'Analytics'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">{item}</a>
                    ))}
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="px-5 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/20 transition-all">Login</button>
                </div>
            </nav>

            {/* 1. HERO SECTION (SPLIT LAYOUT) */}
            <section id="home" className="min-h-screen relative flex flex-col lg:flex-row border-b border-white/5 pt-20 lg:pt-0">
                {/* Atmospheric Backgrounds */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px]"></div>
                </div>

                {/* Left Side: Content */}
                <div className="w-full lg:w-[60%] flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative z-10 py-20 lg:py-0">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Advanced AI Orchestration</span>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-sans font-bold leading-[1.1] mb-8 tracking-tight max-w-2xl">
                            AI-Powered <br />
                            <span className="text-primary italic">School Management.</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-white/40 leading-relaxed max-w-xl mb-12 font-medium">
                            Manage admissions, academics, finance, compliance, and communication in one <span className="text-white">unified platform</span>. Intelligent automation for a smarter campus.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-5 mb-16">
                            <button className="px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/90 transition-all shadow-xl shadow-white/5 active:scale-95">Get Started</button>
                            <button className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all active:scale-95">Request Demo</button>
                        </div>

                        {/* Social Proof / Stats */}
                        <div className="flex gap-12">
                            <div>
                                <p className="text-2xl font-bold">150+</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-white/20 mt-1">Institutions</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">1M+</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-white/20 mt-1">Students</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">99.9%</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-white/20 mt-1">Uptime</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Right Side: Authentication */}
                <div className="w-full lg:w-[40%] flex items-center justify-center p-6 sm:p-12 lg:p-20 relative z-10 bg-[#050508]/50 lg:bg-transparent lg:border-l lg:border-white/5">
                    <div className="w-full max-w-[480px]">
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
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
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
            </section>

            {/* 2. AI VALUE PROPOSITION */}
            <section id="features" className="py-32 px-8 sm:px-12 lg:px-24 xl:px-32 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

                <div className="text-center mb-24">
                    <h2 className="text-3xl lg:text-5xl font-sans font-bold tracking-tight mb-6">Revolutionizing Education <br /> with Intelligence.</h2>
                    <p className="text-white/40 max-w-xl mx-auto uppercase text-[10px] font-black tracking-[0.3em]">Operational clarity through modular automation</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            title: 'Intelligent Automation',
                            desc: 'Automate attendance tracking, complex fee structures, and regulatory compliance without manual intervention.',
                            icon: <ShieldCheckIcon className="w-6 h-6" />
                        },
                        {
                            title: 'Real-Time Insights',
                            desc: 'Access hyper-granular financial dashboards and academic metrics with intelligent predictive analytics.',
                            icon: <CheckCircleIcon className="w-6 h-6" />
                        },
                        {
                            title: 'Smart Communication',
                            desc: 'A unified hub synchronizing administrators, educators, and parents through encrypted institutional channels.',
                            icon: <MailIcon className="w-6 h-6" />
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.2 }}
                            viewport={{ once: true }}
                            className="group p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/20 transition-all duration-500"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-primary mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                            <p className="text-white/40 text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* 3. SCHOOL MODULE PREVIEW */}
            <section id="modules" className="py-32 px-8 sm:px-12 lg:px-24 xl:px-32 bg-[#050508]/50">
                <div className="flex flex-col lg:flex-row justify-between items-end mb-20 gap-8">
                    <div className="max-w-2xl">
                        <h2 className="text-3xl lg:text-5xl font-sans font-bold tracking-tight mb-6">A Unified Ecosystem <br /> for Every Operational Need.</h2>
                        <p className="text-white/40 text-lg">Integrated modules designed specifically for modern institutional workflows.</p>
                    </div>
                    <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3">
                        Explore Documentation <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { title: 'Admissions', icon: <PlusIcon className="w-5 h-5" />, color: 'indigo' },
                        { title: 'Academics', icon: <SchoolIcon className="w-5 h-5" />, color: 'emerald' },
                        { title: 'Finance & Fees', icon: <ShieldCheckIcon className="w-5 h-5" />, color: 'amber' },
                        { title: 'Compliance', icon: <ShieldCheckIcon className="w-5 h-5" />, color: 'rose' },
                        { title: 'Document Vault', icon: <CheckCircleIcon className="w-5 h-5" />, color: 'blue' },
                        { title: 'Communication hub', icon: <MailIcon className="w-5 h-5" />, color: 'purple' },
                        { title: 'Analytics Dashboard', icon: <BarChartIcon className="w-5 h-5" />, color: 'cyan' },
                        { title: 'Staff & HR', icon: <CheckCircleIcon className="w-5 h-5" />, color: 'orange' },
                        { title: 'Transport', icon: <SchoolIcon className="w-5 h-5" />, color: 'slate' }
                    ].map((module, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            viewport={{ once: true }}
                            className="group p-8 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="p-3 bg-white/5 rounded-xl text-white/40 group-hover:text-white group-hover:bg-primary/20 transition-all">
                                    {module.icon}
                                </div>
                                <h4 className="font-bold tracking-tight">{module.title}</h4>
                            </div>
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRightIcon className="w-4 h-4 text-white/20" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* 4. DASHBOARD PREVIEW */}
            <section id="analytics" className="py-32 px-8 sm:px-12 lg:px-24 xl:px-32 relative">
                <div className="mb-20 text-center">
                    <h2 className="text-3xl lg:text-5xl font-sans font-bold tracking-tight mb-6">Operational Clarity. <br /> Built-in.</h2>
                    <p className="text-white/40 max-w-2xl mx-auto">Experience the power of real-time data synthesis. Monitor your institution's health with professional-grade analytics and automated reporting.</p>
                </div>

                <div className="relative max-w-6xl mx-auto p-4 sm:p-8 rounded-[3rem] bg-gradient-to-br from-indigo-500/10 via-primary/5 to-transparent border border-white/10 shadow-3xl overflow-hidden group">
                    {/* Mock Dashboard UI */}
                    <div className="bg-[#0c0e12] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden aspect-[16/10] flex flex-col">
                        <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                            </div>
                            <div className="h-4 w-32 bg-white/5 rounded-full"></div>
                        </div>
                        <div className="flex-grow p-8 grid grid-cols-12 gap-6">
                            <div className="col-span-8 flex flex-col gap-6">
                                <div className="h-32 bg-white/5 rounded-3xl border border-white/5 p-6 flex flex-col justify-end">
                                    <div className="h-4 w-1/4 bg-primary/20 rounded-full mb-3"></div>
                                    <div className="h-8 w-1/2 bg-white/10 rounded-full"></div>
                                </div>
                                <div className="flex-grow bg-white/[0.03] rounded-3xl border border-white/5 p-6 flex items-end gap-2">
                                    {[40, 70, 45, 90, 65, 80, 50, 60].map((h, i) => (
                                        <div key={i} className="flex-grow bg-primary/20 rounded-t-lg transition-all group-hover:bg-primary/40" style={{ height: `${h}%` }}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-4 flex flex-col gap-6">
                                <div className="h-1/2 bg-white/[0.03] rounded-3xl border border-white/5 p-6 flex flex-col gap-4">
                                    <div className="h-4 w-2/3 bg-white/5 rounded-full"></div>
                                    <div className="flex-grow flex items-center justify-center">
                                        <div className="w-24 h-24 rounded-full border-[8px] border-primary/20 border-t-primary"></div>
                                    </div>
                                </div>
                                <div className="h-1/2 bg-white/[0.03] rounded-3xl border border-white/5 p-6 space-y-4">
                                    <div className="h-3 w-full bg-white/5 rounded-full"></div>
                                    <div className="h-3 w-4/5 bg-white/5 rounded-full"></div>
                                    <div className="h-3 w-5/6 bg-white/5 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Data Nodes Decor */}
                    <div className="absolute top-20 right-20 p-6 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-2xl shadow-2xl animate-bounce duration-[3000ms] hidden lg:block">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                                <CheckCircleIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-emerald-500/50 tracking-widest">Compliance</p>
                                <p className="text-sm font-bold">100% Verified</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-8 sm:px-12 lg:px-24 xl:px-32 border-t border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex items-center gap-3">
                        <SchoolIcon className="h-6 w-6 text-primary" />
                        <span className="text-lg font-bold tracking-tight">Universepi</span>
                    </div>
                    <div className="flex gap-10">
                        {['Privacy', 'Terms', 'Security', 'Compliance'].map(item => (
                            <span key={item} className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors cursor-pointer">{item}</span>
                        ))}
                    </div>
                    <div className="text-[10px] text-white/10 font-black uppercase tracking-[0.4em]">
                        Universepi Institutional Grade OS &copy; 2026 • v9.7.2
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AuthPage;
