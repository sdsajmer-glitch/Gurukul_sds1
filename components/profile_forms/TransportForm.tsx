import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { TransportProfileData, BusRoute } from '../../types';
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';
import { LocationIcon as MapPinIcon } from '../icons/LocationIcon';
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
            const { data } = await supabase.from('routes').select('*');
            if (data) setRoutes(data);
            setLoadingRoutes(false);
        };
        fetchRoutes();
    }, []);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-5 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="m13 17-2-1H3" /></svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Logistics Intelligence</h3>
                    <p className="text-[11px] text-white/30 font-medium tracking-widest italic">Route & fleet specification.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <PremiumSelect
                    label="Navigational Vector (Route)"
                    name="route_id"
                    value={formData.route_id || ''}
                    onChange={handleChange}
                    required
                    disabled={loadingRoutes}
                    icon={<MapPinIcon className="w-5 h-5 text-white/20" />}
                >
                    <option value="" disabled className="bg-slate-900">
                        {loadingRoutes ? 'Scanning route registry...' : 'Select assigned vector...'}
                    </option>
                    {routes.map(route => (
                        <option key={route.id} value={route.id} className="bg-slate-900">{route.name}</option>
                    ))}
                </PremiumSelect>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FloatingPremiumInput
                        label="Chassis Specification (Vehicle)"
                        name="vehicle_details"
                        value={formData.vehicle_details || ''}
                        onChange={handleChange}
                        placeholder="e.g. Node-5 (ABC-123)"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" /><polyline points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                    />
                    <FloatingPremiumInput
                        label="Operator Auth Protocol (License)"
                        name="license_info"
                        value={formData.license_info || ''}
                        onChange={handleChange}
                        placeholder="e.g. Commercial Auth-L3"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
                    />
                </div>
            </div>
        </div>
    );
};

export default TransportForm;
