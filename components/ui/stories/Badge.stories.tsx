import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../Badge';
import React from 'react';

const meta: Meta<typeof Badge> = {
    title: 'UI/Badge',
    component: Badge,
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const AllStatuses: Story = {
    render: () => (
        <div className="flex gap-2 flex-wrap">
            <Badge status="verified" />
            <Badge status="premium" />
            <Badge status="locked" />
            <Badge status="pending" />
            <Badge status="error" />
        </div>
    ),
};
