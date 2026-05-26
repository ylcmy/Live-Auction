import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FE2C55',
          hover: '#FF4D6A',
          subtle: 'rgba(254,44,85,0.15)',
        },
        accent: {
          DEFAULT: '#25F4EE',
        },
        surface: {
          primary: '#000000',
          secondary: '#121212',
          card: '#1E1E1E',
          elevated: '#252525',
          overlay: 'rgba(0,0,0,0.7)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#C4C4C4',
          tertiary: '#8A8A8A',
        },
        success: '#00D166',
        warning: '#FFBA00',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        full: '9999px',
      },
      boxShadow: {
        'glow-brand': '0 0 12px rgba(254,44,85,0.4)',
        'glow-accent': '0 0 12px rgba(37,244,238,0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config
