import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { TransportProfileData, BusRoute } from '../../types';
import { TransportIcon } from '../icons/TransportIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { HashIcon } from '../icons/HashIcon';
import { IdCardIcon } from '../icons/IdCardIcon';
import PremiumFloatingInput from '../common/PremiumFloatingInput';
import CustomSelect from '../common/CustomSelect';
import Spinner from '../common/Spinner';

interface FormProps {
    formData: Partial<TransportProfileData>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const TransportForm: React.FC<FormProps> = ({ formData, handleChange }) => {
    const [routes, setRoutes] = useState<BusRoute[]>([]);
    const [loadingRoutes, setLoadingRoutes] = useState(true);

    useEffect(() => {
        const fetchRoutes = async () => {
            setLoadingRoutes(true);
            const { data, error } = await supabase.from('routes').select('*');
            if (data) {
                setRoutes(data);
            }
            setLoadingRoutes(false);
        };
        fetchRoutes();
    }, []);

    const handleSelectChange = (name: string) => (value: string) => {
        handleChange({ target: { name, value } } as any);
    };

    return (
        <div className="space-y-16">
            {/* Logistics Protocol Module */}
            <div className="space-y-10">
                <div className="flex items-center gap-6 mb-2">
                    <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                        <TransportIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase glow-text mb-1">Logistics Protocol</h3>
                        <p className="text-[10px] text-white/30 font-bold tracking-widest">Navigation and transit telemetry synchronization.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
                    <div className="md:col-span-2">
                        <CustomSelect
                            label="Deployment Route"
                            value={formData.route_id || ''}
                            onChange={handleSelectChange('route_id')}
                            options={routes.map(r => ({ value: r.id, label: r.name }))}
                            placeholder={loadingRoutes ? "Synchronizing Routes..." : "Assign Active Route..."}
                            icon={loadingRoutes ? <Spinner size="sm" /> : <LocationIcon />}
                            searchable
                            disabled={loadingRoutes}
                        />
                    </div>

                    <PremiumFloatingInput
                        label="Transit Vehicle Node"
                        name="vehicle_details"
                        value={formData.vehicle_details || ''}
                        onChange={handleChange as any}
                        placeholder="e.g., Node-05 [ABC-123]"
                        icon={<HashIcon />}
                    />

                    <PremiumFloatingInput
                        label="License Authorization"
                        name="license_info"
                        value={formData.license_info || ''}
                        onChange={handleChange as any}
                        placeholder="e.g., Class-A Institutional"
                        icon={<IdCardIcon />}
                    />
                </div>
            </div>

            {/* Signal Strength Visualizer (Decorative) */}
            <div className="p-8 rounded-[2rem] bg-amber-500/[0.03] border border-amber-500/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Transit Signal: Active</span>
                </div>
                <div className="flex gap-1 h-3 items-end">
                    {[40, 70, 50, 90, 60].map((h, i) => (
                        <div key={i} className="w-1 bg-amber-400/20 rounded-full" style={{ height: `${h}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TransportForm;
