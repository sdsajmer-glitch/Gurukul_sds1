import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardBody, CardFooter } from '../Card';
import { Button } from '../Button';
import React from 'react';

const meta: Meta<typeof Card> = {
    title: 'UI/Card',
    component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
    render: () => (
        <Card>
            <CardHeader title="Default Card" />
            <CardBody>Standard artifact content</CardBody>
            <CardFooter>
                <Button>View</Button>
            </CardFooter>
        </Card>
    ),
};

export const Verified: Story = {
    render: () => (
        <Card variant="verified">
            <CardHeader title="Verified Artifact" />
            <CardBody>Verified credential content</CardBody>
            <CardFooter>
                <Button>View</Button>
            </CardFooter>
        </Card>
    ),
};

export const Premium: Story = {
    render: () => (
        <Card variant="premium">
            <CardHeader title="Premium Artifact" />
            <CardBody>Premium access credential</CardBody>
            <CardFooter>
                <Button>Unlock</Button>
            </CardFooter>
        </Card>
    ),
};

export const Disabled: Story = {
    render: () => (
        <Card variant="disabled">
            <CardHeader title="Disabled Artifact" />
            <CardBody>Unavailable content</CardBody>
        </Card>
    ),
};
