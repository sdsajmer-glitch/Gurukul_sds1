import type { Meta, StoryObj } from '@storybook/react';
import { ArtifactCard } from '../ArtifactCard';

const meta: Meta<typeof ArtifactCard> = {
    title: 'Domain/ArtifactCard',
    component: ArtifactCard,
};

export default meta;
type Story = StoryObj<typeof ArtifactCard>;

export const Standard: Story = {
    args: {
        title: 'Identity Credential',
        tier: 'standard',
    },
};

export const Premium: Story = {
    args: {
        title: 'Premium Verification',
        tier: 'premium',
    },
};

export const Locked: Story = {
    args: {
        title: 'Restricted Artifact',
        tier: 'locked',
    },
};
