import clsx from 'clsx';
import React from 'react';

export type BadgeStatus = 'verified' | 'premium' | 'locked' | 'pending' | 'error' | 'default';

export function Badge({ status, text }: { status: BadgeStatus, text?: string }) {
    const label = text || status;
    return (
        <span
            className={clsx(
                'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center border',
                {
                    'bg-accent-info/10 text-accent-info border-accent-info/20': status === 'verified',
                    'bg-accent-premium/10 text-accent-premium border-accent-premium/20': status === 'premium',
                    'bg-accent-warning/10 text-accent-warning border-accent-warning/20': status === 'pending',
                    'bg-accent-error/10 text-accent-error border-accent-error/20': status === 'error',
                    'bg-bg-secondary text-text-tertiary border-white/5': status === 'locked',
                    'bg-white/5 text-text-secondary border-white/10': status === 'default',
                }
            )}
        >
            {label}
        </span>
    );
}
