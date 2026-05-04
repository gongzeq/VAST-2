import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tone vocabulary used by StatusBadge etc.
        tone: {
          destructive: '#dc2626',
          'destructive-bg': '#fee2e2',
          warning: '#d97706',
          'warning-bg': '#fef3c7',
          caution: '#b45309',
          'caution-bg': '#fef3c7',
          positive: '#16a34a',
          'positive-bg': '#dcfce7',
          muted: '#6b7280',
          'muted-bg': '#f3f4f6',
          info: '#2563eb',
          'info-bg': '#dbeafe',
        },
      },
    },
  },
  plugins: [],
};

export default config;
