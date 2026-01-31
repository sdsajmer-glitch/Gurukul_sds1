import React from 'react';
import { EcommerceProfileData } from '../../types';
import { FloatingPremiumInput } from '../common/Inputs';
import { SparklesIcon } from '../icons/SparklesIcon';

interface FormProps {
    formData: Partial<EcommerceProfileData>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const EcommerceForm: React.FC<FormProps> = ({ formData, handleChange }) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-5 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Commerce Registry</h3>
                    <p className="text-[11px] text-white/30 font-medium tracking-widest italic">Institutional supply-chain identity.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <FloatingPremiumInput
                    label="Canonical Business Descriptor"
                    name="store_name"
                    value={formData.store_name || ''}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Genesis Uniform Hub"
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>}
                />
                <FloatingPremiumInput
                    label="Operational Sector"
                    name="business_type"
                    value={formData.business_type || ''}
                    onChange={handleChange}
                    placeholder="e.g. Textile / Logistics / Scholastic"
                    icon={<SparklesIcon className="w-5 h-5" />}
                />
            </div>
        </div>
    );
};

export default EcommerceForm;
