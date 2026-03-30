// Clinical color system for PreOp Intel.
// Risk colors follow medical convention: green (safe) → yellow (caution) → red (danger) → purple (critical).
// Typography: Inter for UI (high x-height readability), JetBrains Mono for clinical values.
// Design ref: Epic Morning Report layout — clean, high-density, no decorative chrome.

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          'very-low': '#10B981',
          low: '#22C55E',
          moderate: '#F59E0B',
          high: '#EF4444',
          critical: '#7C3AED',
        },
        clinical: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          border: '#E2E8F0',
          'text-primary': '#0F172A',
          'text-muted': '#64748B',
          accent: '#0EA5E9',
          'accent-dark': '#0284C7',
        },
        agent: {
          idle: '#94A3B8',
          running: '#3B82F6',
          complete: '#10B981',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
