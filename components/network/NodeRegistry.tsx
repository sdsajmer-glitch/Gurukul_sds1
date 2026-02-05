import React from 'react';

interface NodeRegistryProps {
    children: React.ReactNode;
}

export function NodeRegistry({ children }: NodeRegistryProps) {
    return (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children}
        </section>
    );
}
