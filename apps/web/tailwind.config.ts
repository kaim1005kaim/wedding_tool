import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ecru: 'var(--ecru)',
        ink: 'var(--ink)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        brand: {
          blue: {
            50: 'var(--blue-50)',
            200: 'var(--blue-200)',
            400: 'var(--blue-400)',
            600: 'var(--blue-600)',
            700: 'var(--blue-700)'
          },
          terra: {
            50: 'var(--terra-50)',
            200: 'var(--terra-200)',
            400: 'var(--terra-400)',
            600: 'var(--terra-600)',
            700: 'var(--terra-700)'
          }
        }
      },
      boxShadow: {
        brand: 'var(--shadow)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif']
      }
    }
  },
  plugins: []
};

export default config;
