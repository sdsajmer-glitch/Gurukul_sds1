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
const PricingSelectionPage: React.FC<PricingSelectionPageProps> = ({ onComplete, onBack }) => {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const handleSelectPlan = async (planId: string) => {
        if (loading) return;
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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
            {/* Background decorative elements */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

            <div className="text-center max-w-3xl mx-auto mb-20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-6">
                    Institutional Architecture
                </div>
                <h2 className="text-5xl md:text-7xl font-serif font-black text-foreground tracking-tight mb-6">
                    Select Your <span className="text-primary italic">Scale.</span>
                </h2>
                <p className="text-muted-foreground text-lg md:text-xl leading-relaxed font-medium max-w-2xl mx-auto">
                    Configure your institutional node network based on your operational complexity. Scaling is fluid and can be adjusted as your network grows.
                </p>
            </div>

            {error && (
                <div className="mb-12 p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] text-center font-bold animate-in bounce-in">
                    <p className="text-sm uppercase tracking-widest font-black mb-1">Authorization Conflict</p>
                    <p className="text-xs opacity-70">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch">
                {basePlans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`
                            relative flex flex-col p-8 md:p-10 rounded-[3rem] border-2 transition-all duration-500 group
                            ${plan.recommended
                                ? 'bg-primary/5 border-primary shadow-[0_32px_80px_-20px_rgba(var(--primary-rgb),0.2)] scale-[1.02] lg:scale-105 z-10'
                                : 'bg-card/40 backdrop-blur-xl border-white/5 hover:border-primary/40 hover:bg-card/60'
                            }
                        `}
                    >
                        {plan.recommended && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-xl">
                                Recommended Configuration
                            </div>
                        )}

                        <div className="mb-10">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-2 block">{plan.label}</span>
                            <h3 className="text-4xl font-black text-foreground tracking-tight">{plan.branches}</h3>
                        </div>

                        <p className="text-sm text-muted-foreground font-medium mb-10 leading-relaxed min-h-[4rem]">
                            {plan.description}
                        </p>

                        <div className="space-y-5 mb-12 flex-grow">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">Included Protocols</p>
                            {plan.features.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-3 group/item">
                                    <div className={`mt-1 w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${plan.recommended ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground group-hover/item:text-primary group-hover/item:bg-primary/10'}`}>
                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-bold text-foreground/70 group-hover/item:text-foreground transition-colors">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={loading}
                            className={`
                                w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] transition-all transform active:scale-95 flex items-center justify-center
                                ${plan.recommended
                                    ? 'bg-primary text-white shadow-2xl shadow-primary/30 hover:bg-primary/90'
                                    : 'bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black hover:border-white shadow-lg'
                                }
                                ${loading && selectedPlan === plan.id ? 'opacity-70 cursor-wait' : ''}
                            `}
                        >
                            {loading && selectedPlan === plan.id ? (
                                <Spinner size="sm" className={plan.recommended ? 'text-white' : 'text-black'} />
                            ) : (
                                <span>Initialize Plan</span>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {onBack && (
                <div className="mt-20 text-center">
                    <button
                        onClick={onBack}
                        disabled={loading}
                        className="group inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-white transition-all disabled:opacity-50"
                    >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-all">
                            <ChevronLeftIcon className="w-4 h-4" />
                        </div>
                        Back to Identity Node
                    </button>
                </div>
            )}
        </div>
    );
};

export default PricingSelectionPage;