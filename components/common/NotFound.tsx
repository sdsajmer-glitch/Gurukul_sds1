import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface NotFoundProps {
    redirectTo?: string;
}

const NotFound: React.FC<NotFoundProps> = ({ redirectTo = '/' }) => {
    const navigate = useNavigate();
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);

        const redirectTimer = setTimeout(() => {
            navigate(redirectTo, { replace: true });
        }, 4500); // Confidence-building pause

        return () => {
            clearInterval(interval);
            clearTimeout(redirectTimer);
        };
    }, [navigate, redirectTo]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0f1116] to-[#08090a] text-foreground relative overflow-hidden font-sans">
            {/* Soft Background Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

            {/* Focal Point: Dual-Ring Motion Halo */}
            <div className="relative mb-16 flex items-center justify-center">
                {/* Expanding Outer Ring */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.05, 0.2, 0.05]
                    }}
                    transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute w-32 h-32 bg-primary/30 rounded-full blur-3xl"
                />
                
                {/* Sharp Inner Core */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2 }}
                    className="relative w-14 h-14 rounded-full border border-white/5 flex items-center justify-center bg-white/[0.02] shadow-[inset_0_0_15px_rgba(255,255,255,0.02)]"
                >
                    {/* Pulsing Core Node */}
                    <motion.div 
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                    />
                </motion.div>
            </div>

            {/* Content Transition */}
            <div className="relative z-10 text-center space-y-4 px-6">
                <AnimatePresence mode="wait">
                    {timer < 3 ? (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        >
                            <h2 className="text-xl md:text-2xl font-serif font-black text-white/90 tracking-tight uppercase">
                                Redirecting you safely
                            </h2>
                            <p className="text-[14px] font-medium text-white/40 tracking-widest mt-2 font-serif italic">
                                NO ACTION IS REQUIRED
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="waiting"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        >
                            <h2 className="text-xl md:text-2xl font-serif font-black text-white/90 tracking-tight uppercase">
                                Almost there
                            </h2>
                            <p className="text-[14px] font-medium text-white/40 tracking-widest mt-2 font-serif italic">
                                PREPARING YOUR SECURE CONTEXT
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Global Branding Subtitle */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ delay: 2, duration: 2 }}
                className="absolute bottom-12 text-[10px] font-black uppercase tracking-[0.6em] text-white select-none pointer-events-none"
            >
                Gurukul OS • High Fidelity Governance
            </motion.div>
        </div>
    );
};

export default NotFound;