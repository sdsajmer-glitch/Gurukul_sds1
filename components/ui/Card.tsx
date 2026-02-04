import clsx from 'clsx';
import React from 'react';

type CardVariant = 'default' | 'verified' | 'premium' | 'disabled';

interface CardProps {
    variant?: CardVariant;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function Card({ variant = 'default', children, className, onClick }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={clsx(
                'rounded-2xl border p-6 transition flex flex-col',
                'bg-bg-card border-border-subtle',
                {
                    'ring-1 ring-accent-info/30 shadow-glow-info': variant === 'verified',
                    'ring-1 ring-accent-premium/40 shadow-2xl': variant === 'premium',
                    'opacity-60 pointer-events-none': variant === 'disabled',
                    'hover:shadow-2xl hover:-translate-y-1': variant !== 'disabled',
                },
                className
            )}
        >
            {children}
        </div>
    );
}

export const CardHeader = ({ title, children }: { title?: string, children?: React.ReactNode }) => (
    <div className="mb-4">
        {title && <h3 className="text-text-primary font-bold text-lg leading-tight">{title}</h3>}
        {children}
    </div>
);

export const CardBody = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={clsx("text-text-secondary text-sm flex-grow", className)}>{children}</div>
);

export const CardFooter = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={clsx("mt-auto pt-4 flex gap-3", className)}>{children}</div>
);
