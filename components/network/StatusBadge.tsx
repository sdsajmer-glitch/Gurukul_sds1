import React from 'react';

export type NodeStatus = 'active' | 'pending' | 'provisioned' | 'head-office';

interface StatusBadgeProps {
    status: NodeStatus;
    className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const styles = {
        'active': "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
        'pending': "bg-amber-500/10 text-amber-500 ring-amber-500/20",
        'provisioned': "bg-blue-500/10 text-blue-400 ring-blue-500/20",
        'head-office': "bg-primary/10 text-primary ring-primary/20",
    };

    const labels = {
        'active': 'Active Link',
        'pending': 'Pending',
        'provisioned': 'Provisioned',
        'head-office': 'Head Office',
    };

    return (
        <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ${styles[status]} ${className}`}
        >
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' || status === 'head-office' ? 'bg-current' : 'bg-current'}`} />
            <span>{labels[status]}</span>
        </span>
    );
}
