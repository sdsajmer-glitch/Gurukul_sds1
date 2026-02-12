
import React from 'react';
import { DuesDashboardData, StudentDuesInfo, ClassDuesInfo } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { AlarmClockIcon } from '../icons/AlarmClockIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { BellIcon } from '../icons/BellIcon';
import { FilterIcon } from '../icons/FilterIcon';

const DuesByClassChart: React.FC<{ data: ClassDuesInfo[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.total_dues), 1);
    return (
        <div className="bg-white/[0.01] p-10 rounded-[3.5rem] border border-white/5 shadow-3xl h-[450px] flex flex-col relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            <div className="flex justify-between items-center mb-10">
                <div className="space-y-1.5">
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] ml-1">Segmentation Logic</h4>
                    <p className="text-2xl font-serif font-black text-white uppercase tracking-tight">Dues Distribution by Class</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-2xl"><FilterIcon className="w-6 h-6" /></div>
            </div>
            <div className="flex-grow flex items-end gap-6 px-4 pb-4">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-5 group h-full justify-end">
                        <div className="relative w-full h-full flex items-end">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(item.total_dues / maxValue) * 100}%` }}
                                transition={{ duration: 1.5, ease: "circOut", delay: index * 0.1 }}
                                className="w-full bg-gradient-to-t from-primary/30 via-primary/10 to-transparent group-hover:from-primary/50 group-hover:via-primary/20 rounded-t-[1.5rem] transition-all duration-700 relative border-t-2 border-primary/20 shadow-[0_-20px_40px_-15px_rgba(var(--primary),0.2)]"
                            >
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/90 text-white font-mono font-black text-[11px] px-4 py-2 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/10 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20">
                                    ₹{item.total_dues.toLocaleString()}
                                </div>
                                <div className="absolute inset-0 bg-primary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </motion.div>
                        </div>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] truncate w-full text-center group-hover:text-primary transition-colors duration-500">{item.class_name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DuesDashboard: React.FC<{ data: DuesDashboardData }> = ({ data }) => {
    return (
        <div className="space-y-12 animate-in fade-in duration-1000">
            {/* 1. Overview Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white/[0.01] p-12 rounded-[3.5rem] border border-white/10 shadow-3xl group hover:border-primary/40 transition-all duration-700 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-12">
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.6em] ml-1">Total Pending</h3>
                            <div className="w-10 h-0.5 bg-primary/30"></div>
                        </div>
                        <div className="p-5 bg-primary/10 rounded-2xl text-primary border border-primary/20 group-hover:rotate-12 transition-transform duration-700 shadow-2xl shadow-primary/10"><DollarSignIcon className="w-7 h-7" /></div>
                    </div>
                    <p className="text-6xl font-serif font-black text-white tabular-nums tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]">₹{data.total_dues.toLocaleString()}</p>
                </div>

                <div className="bg-white/[0.01] p-12 rounded-[3.5rem] border border-white/10 shadow-3xl group hover:border-red-500/40 transition-all duration-700 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-transparent pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-12">
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.6em] ml-1">Forensic Overdue</h3>
                            <div className="w-10 h-0.5 bg-red-500/30"></div>
                        </div>
                        <div className="p-5 bg-red-500/10 rounded-2xl text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform duration-700 shadow-2xl shadow-red-500/10"><AlarmClockIcon className="w-7 h-7" /></div>
                    </div>
                    <p className="text-6xl font-serif font-black text-red-500 tabular-nums tracking-tighter drop-shadow-[0_0_30px_rgba(239,68,68,0.15)]">₹{data.total_overdue.toLocaleString()}</p>
                </div>

                <div className="bg-white/[0.01] p-12 rounded-[3.5rem] border border-white/10 shadow-3xl group hover:border-white/30 transition-all duration-700 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-12">
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.6em] ml-1">Exposure Nodes</h3>
                            <div className="w-10 h-0.5 bg-white/20"></div>
                        </div>
                        <div className="p-5 bg-white/5 rounded-2xl text-white/40 border border-white/10 group-hover:rotate-[-12deg] transition-transform duration-700 shadow-2xl"><UsersIcon className="w-7 h-7" /></div>
                    </div>
                    <p className="text-6xl font-serif font-black text-white tabular-nums tracking-tighter">{data.overdue_student_count}</p>
                </div>
            </div>

            {/* 2. Command Strip */}
            <div className="bg-white/[0.01] p-8 rounded-[3rem] border border-white/10 shadow-3xl flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden group/strip">
                <div className="absolute inset-x-0 h-px bg-white/5 top-0 group-hover/strip:bg-white/10 transition-colors"></div>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-5 bg-black/60 border border-white/5 px-8 py-4 rounded-2xl shadow-inner group/select hover:border-primary/20 transition-all duration-500">
                        <FilterIcon className="w-5 h-5 text-white/10 group-hover/select:text-primary transition-colors" />
                        <select className="bg-transparent text-[12px] font-black text-white/40 uppercase tracking-[0.3em] outline-none cursor-pointer focus:text-white transition-colors"><option>All Classes</option></select>
                    </div>
                    <div className="flex items-center gap-5 bg-black/60 border border-white/5 px-8 py-4 rounded-2xl shadow-inner group/select2 hover:border-primary/20 transition-all duration-500">
                        <UsersIcon className="w-5 h-5 text-white/10 group-hover/select2:text-primary transition-colors" />
                        <select className="bg-transparent text-[12px] font-black text-white/40 uppercase tracking-[0.3em] outline-none cursor-pointer focus:text-white transition-colors">
                            <option>All Statuses</option>
                            <option>Overdue</option>
                            <option>Pending</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-8 w-full md:w-auto">
                    <button onClick={() => alert('RECALL_STRATEGY_INITIALIZED')} className="flex-1 md:flex-none h-16 px-14 rounded-2xl text-[11px] font-black uppercase text-white/20 hover:text-white hover:bg-white/5 border border-white/5 transition-all tracking-[0.5em] active:scale-95">
                        Schedule Reminders
                    </button>
                    <button onClick={() => alert(`ALERT_WAVE_DISPATCHED_TO_${data.overdue_student_count}_NODES`)} className="flex-1 md:flex-none h-16 px-16 bg-red-600/10 text-red-500 font-black text-[11px] uppercase tracking-[0.6em] rounded-2xl shadow-3xl shadow-red-500/10 hover:bg-red-600 hover:text-white transition-all transform active:scale-95 border border-red-500/20 group/alert ring-4 ring-red-500/5">
                        <div className="flex items-center gap-4">
                            Dispatch Recall Alerts <BellIcon className="w-5 h-5 group-hover/alert:animate-bounce" />
                        </div>
                    </button>
                </div>
            </div>

            {/* 3. Breakdown Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2">
                    <DuesByClassChart data={data.dues_by_class} />
                </div>
                <div className="bg-white/[0.01] p-12 rounded-[4rem] border border-white/10 shadow-3xl relative overflow-hidden flex flex-col group/registry">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
                    <div className="space-y-2 mb-12">
                        <h4 className="text-[11px] font-black text-red-500/40 uppercase tracking-[0.6em] ml-1">Critical Exposure</h4>
                        <p className="text-2xl font-serif font-black text-white uppercase tracking-tight">Priority Recall Registry</p>
                    </div>
                    <div className="space-y-6 overflow-y-auto max-h-[350px] custom-scrollbar pr-3">
                        {data.highest_dues_students.length > 0 ? data.highest_dues_students.map((student, idx) => (
                            <div key={student.student_id} className="flex justify-between items-center p-8 bg-white/[0.02] rounded-[2.5rem] border border-white/5 hover:border-red-500/30 transition-all duration-500 group/item cursor-pointer relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500/[0.02] to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center font-black text-sm border border-red-500/20 shadow-inner group-hover/item:scale-110 transition-transform">{idx + 1}</div>
                                    <div className="space-y-1">
                                        <p className="text-base font-serif font-black text-white uppercase tracking-tight group-hover/item:text-red-400 transition-colors">{student.display_name}</p>
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{student.class_name}</p>
                                    </div>
                                </div>
                                <p className="text-xl font-serif font-black text-white tabular-nums tracking-tighter group-hover/item:scale-110 transition-transform relative z-10">₹{student.outstanding_balance.toLocaleString()}</p>
                            </div>
                        )) : <div className="pt-24 text-center space-y-6 opacity-20">
                            <UsersIcon className="w-16 h-16 mx-auto" />
                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">No Delinquent Nodes Detected</p>
                        </div>}
                    </div>
                    <div className="mt-8 pt-10 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                Registry Integrity
                            </div>
                            <span className="text-emerald-500/60 font-mono tracking-widest">SECURE_SYNCED</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DuesDashboard;
