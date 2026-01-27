import React from 'react';
import { motion } from 'framer-motion';
import { EcommerceProfileData } from '../../types';
import { CartIcon } from '../icons/CartIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { LayersIcon } from '../icons/LayersIcon';
import PremiumFloatingInput from '../common/PremiumFloatingInput';

interface FormProps {
    formData: Partial<EcommerceProfileData>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const EcommerceForm: React.FC<FormProps> = ({ formData, handleChange }) => {
    return (
        <div className="space-y-16">
            {/* Commerce Node Module */}
            <div className="space-y-10">
                <div className="flex items-center gap-6 mb-2">
                    <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)]">
                        <CartIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase glow-text mb-1">Commerce Interface</h3>
                        <p className="text-[10px] text-white/30 font-bold tracking-widest uppercase">Institutional marketplace and merchant telemetry.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
                    <PremiumFloatingInput
                        label="Validated Business Core"
                        name="store_name"
                        type="text"
                        value={formData.store_name || ''}
                        onChange={handleChange as any}
                        required
                        placeholder="e.g., Global Scholastic Supplies"
                        icon={<BriefcaseIcon />}
                    />

                    <PremiumFloatingInput
                        label="Merchant Category Vector"
                        name="business_type"
                        type="text"
                        value={formData.business_type || ''}
                        onChange={handleChange as any}
                        placeholder="e.g., Uniforms, Stationery, Digital Assets"
                        icon={<LayersIcon />}
                    />
                </div>
            </div>

            {/* Merchant Status (Decorative) */}
            <div className="flex items-center justify-between p-8 rounded-[2.5rem] bg-emerald-500/[0.03] border border-emerald-500/10">
                <div className="flex items-center gap-6">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                    <div>
                        <p className="text-[11px] font-black text-white uppercase tracking-widest">Global Merchant Status</p>
                        <p className="text-[9px] text-white/20 font-bold tracking-[0.2em] uppercase">Verified Tier 1 Provider</p>
                    </div>
                </div>
                <div className="px-6 py-2 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-primary/60 tracking-widest">
                    ACTIVE SESS
                </div>
            </div>
        </div>
    );
};

export default EcommerceForm;
