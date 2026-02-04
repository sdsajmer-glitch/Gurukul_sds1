import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on.*' },
    controls: { expanded: true },
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0B0D10' }],
    },
  },
};

export default preview;