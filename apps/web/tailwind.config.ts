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
        success: {
          DEFAULT: 'var(--success)',
          light: 'var(--success-light)'
        },
        warning: {
          DEFAULT: 'var(--warning)',
          light: 'var(--warning-light)'
        },
        error: {
          DEFAULT: 'var(--error)',
          light: 'var(--error-light)'
        },
        brand: {
          blue: {
            50: 'var(--blue-50)',
            100: 'var(--blue-100)',
            200: 'var(--blue-200)',
            300: 'var(--blue-300)',
            400: 'var(--blue-400)',
            500: 'var(--blue-500)',
            600: 'var(--blue-600)',
            700: 'var(--blue-700)',
            800: 'var(--blue-800)',
            900: 'var(--blue-900)'
          },
          terra: {
            50: 'var(--terra-50)',
            100: 'var(--terra-100)',
            200: 'var(--terra-200)',
            300: 'var(--terra-300)',
            400: 'var(--terra-400)',
            500: 'var(--terra-500)',
            600: 'var(--terra-600)',
            700: 'var(--terra-700)',
            800: 'var(--terra-800)',
            900: 'var(--terra-900)'
          }
        },
        bauhaus: {
          red: '#ff0000',
          blue: '#0000ff',
          yellow: '#ffff00',
          black: '#000000',
          white: '#ffffff'
        },
        pop: {
          orange: '#FF6B35',
          yellow: '#FFD23F',
          red: '#E63946',
          blue: '#1D9BF0',
          pink: '#FF6BA8',
          green: '#2A9D8F'
        }
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-celebration': 'var(--gradient-celebration)'
      },
      boxShadow: {
        'brand-sm': 'var(--shadow-sm)',
        brand: 'var(--shadow)',
        'brand-md': 'var(--shadow-md)',
        'brand-lg': 'var(--shadow-lg)',
        'brand-xl': 'var(--shadow-xl)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif']
      },
      fontSize: {
        'display-lg': ['4.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-md': ['3.75rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-sm': ['3rem', { lineHeight: '1.2', fontWeight: '600' }],
        'title-lg': ['2.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        'title-md': ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'title-sm': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }]
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem'
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms'
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-in': 'bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'slide-up': 'slide-up 0.5s ease-out',
        'count-up': 'count-up 0.4s ease-out',
        shimmer: 'shimmer 2s infinite'
      }
    }
  },
  plugins: []
};

export default config;
