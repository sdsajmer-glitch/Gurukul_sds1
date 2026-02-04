import clsx from 'clsx';
import { Size } from '../../types/ui';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
    variant?: ButtonVariant;
    size?: Size;
    disabled?: boolean;
    children: React.ReactNode;
    onClick?: (e?: React.MouseEvent) => void;
    className?: string;
    title?: string;
}

export function Button({
    variant = 'primary',
    size = 'md',
    disabled = false,
    children,
    onClick,
    className,
    title
}: ButtonProps) {
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            title={title}
            className={clsx(
                'rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary flex items-center justify-center gap-2',
                {
                    'bg-accent-primary text-white hover:brightness-110': variant === 'primary',
                    'bg-bg-secondary text-text-primary hover:bg-white/5': variant === 'secondary',
                    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5': variant === 'ghost',
                    'bg-accent-error text-white hover:bg-accent-error/90': variant === 'destructive',

                    'px-3 py-1.5 text-xs': size === 'sm',
                    'px-4 py-2 text-sm': size === 'md',
                    'px-6 py-3 text-base': size === 'lg',

                    'opacity-50 cursor-not-allowed': disabled,
                    'active:scale-95': !disabled,
                },
                className
            )}
        >
            {children}
        </button>
    );
}
