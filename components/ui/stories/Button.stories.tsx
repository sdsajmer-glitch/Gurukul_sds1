import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../Button';

const meta: Meta<typeof Button> = {
    title: 'UI/Button',
    component: Button,
    args: {
        children: 'Primary Action',
    },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
    args: { variant: 'primary' },
};

export const Secondary: Story = {
    args: { variant: 'secondary' },
};

export const Ghost: Story = {
    args: { variant: 'ghost' },
};

export const Destructive: Story = {
    args: { variant: 'destructive' },
};

export const Disabled: Story = {
    args: { disabled: true },
};

export const Sizes: Story = {
    render: () => (
        <div className="flex gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
        </div>
    ),
};
