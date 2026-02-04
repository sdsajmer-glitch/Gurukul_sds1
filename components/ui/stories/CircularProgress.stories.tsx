import type { Meta, StoryObj } from '@storybook/react';
import { CircularProgress } from '../CircularProgress';
import React from 'react';

const meta: Meta<typeof CircularProgress> = {
    title: 'UI/Progress/Circular',
    component: CircularProgress,
};

export default meta;
type Story = StoryObj<typeof CircularProgress>;

export const Examples: Story = {
    render: () => (
        <div className="flex gap-6">
            <CircularProgress value={25} />
            <CircularProgress value={50} />
            <CircularProgress value={75} />
            <CircularProgress value={100} />
        </div>
    ),
};
