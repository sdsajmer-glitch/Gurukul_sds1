import React from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, BadgeStatus } from '../ui/Badge';
import { UploadIcon } from '../icons/UploadIcon';
import { EyeIcon } from '../icons/EyeIcon';

type ArtifactTier = 'standard' | 'premium' | 'locked';

interface ArtifactCardProps {
    title: string;
    tier: ArtifactTier;
    status?: BadgeStatus;
    subtext?: string;
    onAction: () => void;
    icon?: React.ReactNode;
}

export function ArtifactCard({
    title,
    tier,
    status = 'default',
    subtext,
    onAction,
    icon
}: ArtifactCardProps) {

    const getVariant = () => {
        if (tier === 'locked') return 'disabled';
        if (tier === 'premium') return 'premium';
        if (status === 'verified') return 'verified';
        return 'default';
    };

    return (
        <Card variant={getVariant()} className="h-full">
            <div className="flex justify-between items-start mb-4">
                {icon && <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-white/60">{icon}</div>}
                <Badge status={status} />
            </div>

            <CardHeader title={title}>
                {subtext && <p className="text-xs text-text-tertiary font-mono mt-1">{subtext}</p>}
            </CardHeader>

            <CardBody className="flex items-center justify-center">
                {/* Placeholder for preview or drag drop area content could go here if extracted */}
                <div className="w-full h-32 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center text-white/20 text-xs uppercase tracking-widest">
                    Preview
                </div>
            </CardBody>

            <CardFooter>
                <Button
                    variant={tier === 'locked' ? 'secondary' : 'primary'}
                    onClick={onAction}
                    disabled={tier === 'locked'}
                    className="w-full"
                >
                    {tier === 'locked' ? 'Locked' : status === 'verified' ? <><EyeIcon className="w-4 h-4" /> View</> : <><UploadIcon className="w-4 h-4" /> Upload</>}
                </Button>
            </CardFooter>
        </Card>
    );
}
