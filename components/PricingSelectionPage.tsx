import React, { useState, useEffect, useRef } from 'react';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { UserProfile } from '../types';

interface PricingSelectionPageProps {
    onComplete: () => void;
    onBack?: () => void;
}

interface BasePlan {
    id: string;
    label: string;
    branches: string;
    description: string;
    features: string[];
    recommended?: boolean;
}

const basePlans: BasePlan[] = [
    {
        id: '1_branch',
        label: 'Single Branch',
        branches: '1 Branch',
        description: 'Perfect for individual schools starting out.',
        features: ['Core Admin Features', 'Student Management', 'Basic Reporting', 'Email Support']
    },
    {
        id: '3_branches',
        label: 'Starter Chain',
        branches: '3 Branches',
        description: 'Ideal for small groups expanding their reach.',
        features: ['Multi-branch Dashboard', 'Advanced Analytics', 'Priority Support', 'Custom Branding'],
        recommended: true
    },
    {
        id: '5_branches',
        label: 'Growth Chain',
        branches: '5 Branches',
        description: 'For growing institutions with multiple campuses.',
        features: ['Enterprise API Access', 'Dedicated Account Manager', 'Data Export/Import', 'Unlimited Staff Accounts']
    },
    {
        id: 'unlimited',
        label: 'Enterprise',
        branches: 'Unlimited',
        description: 'Full-scale solution for large educational networks.',
        features: ['Full White Label', 'On-premise Deployment', '24/7 Phone Support', 'Custom Feature Dev']
    },
];

/**
 * Component for selecting an institutional deployment plan.
 */
import { motion } from 'framer-motion';

const PricingSelectionPage: React.FC<PricingSelectionPageProps> = ({ onComplete, onBack }) => {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const handleSelectPlan = async (planId: string) => {
        setSelectedPlan(planId);
        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.rpc('update_school_plan', {
                p_plan_id: planId
            });

            if (updateError) throw updateError;

            if (isMounted.current) onComplete();
        } catch (err: any) {
            if (isMounted.current) {
                setError(formatError(err));
                setLoading(false);
            }
        }
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-3xl mx-auto mb-20 space-y-6"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-3 px-6 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4"
                >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Network Architecture Selection</span>
                </motion.div>
                <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter leading-none">Institutional Scaling</h2>
                <p className="text-white/40 text-lg md:text-xl font-medium leading-relaxed italic max-w-2xl mx-auto">
                    Select a core deployment plan tailored to your institutional complexity. Plans can be adjusted as your node network expands.
                </p>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-12 p-8 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] text-center font-black uppercase tracking-[0.2em]"
                >
                    {error}
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 items-stretch">
                {basePlans.map((plan, idx) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ y: -10 }}
                        className={`
                            relative flex flex-col p-10 rounded-[3rem] border transition-all duration-700 group
                            ${plan.recommended
                                ? 'bg-primary/5 border-primary/50 shadow-[0_30px_100px_rgba(139,92,246,0.2)]'
                                : 'bg-white/[0.02] border-white/10 hover:border-white/30 hover:bg-white/[0.04]'
                            }
                        `}
                    >
                        {plan.recommended && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[9px] font-black uppercase tracking-[0.3em] px-6 py-2.5 rounded-full shadow-2xl z-20">
                                Popular Selection
                            </div>
                        )}

                        <div className="mb-10 relative">
                            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-3">{plan.label}</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-serif font-black text-white tracking-tighter">{plan.branches.split(' ')[0]}</span>
                                <span className="text-lg font-serif italic text-white/30 uppercase tracking-widest">{plan.branches.split(' ')[1] || ''}</span>
                            </div>
                        </div>

                        <p className="text-sm text-white/50 font-medium mb-10 leading-relaxed min-h-[4rem]">
                            {plan.description}
                        </p>

                        <div className="h-px bg-white/5 w-full mb-10" />

                        <ul className="space-y-6 mb-12 flex-grow">
                            {plan.features.map((feature, fIdx) => (
                                <li key={fIdx} className="flex items-start gap-4 text-[10px] font-black uppercase tracking-[0.1em] text-white/70">
                                    <div className="w-5 h-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-[-2px]">
                                        <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span className="leading-tight">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={loading}
                            className={`
                                w-full h-16 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all transform active:scale-95 group relative overflow-hidden
                                ${plan.recommended
                                    ? 'bg-primary text-white shadow-xl shadow-primary/30 hover:shadow-primary/50'
                                    : 'bg-white/5 text-white/50 hover:bg-white hover:text-black hover:shadow-2xl'
                                }
                                ${loading && selectedPlan === plan.id ? 'opacity-50' : ''}
                            `}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {loading && selectedPlan === plan.id ? <Spinner size="sm" className="mx-auto" /> : (
                                <div className="flex items-center justify-center gap-2">
                                    Provision Plan
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
                                </div>
                            )}
                        </button>
                    </motion.div>
                ))}
            </div>

            {onBack && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-20 text-center"
                >
                    <button
                        onClick={onBack}
                        disabled={loading}
                        className="group inline-flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all disabled:opacity-50"
                    >
                        <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-2" />
                        Identify Step Return
                    </button>
                </motion.div>
            )}
        </div>
    );
};

export default PricingSelectionPage;