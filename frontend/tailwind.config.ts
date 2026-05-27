import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FE2C55',
          hover: '#FF4D6D',
          subtle: 'rgba(254,44,85,0.08)',
          50: '#FFF0F3',
          100: '#FFD9E0',
          200: '#FFB3C1',
          300: '#FF8DA3',
          400: '#FF6684',
          500: '#FE2C55',
          600: '#E6264C',
          700: '#CC2244',
          800: '#991933',
          900: '#661122',
        },
        accent: {
          DEFAULT: '#25F4EE',
          secondary: '#6EF7F3',
        },
        surface: {
          primary: '#FFFFFF',
          secondary: '#F8F9FA',
          card: '#FFFFFF',
          elevated: '#FFFFFF',
          overlay: 'rgba(0,0,0,0.5)',
          border: '#E5E7EB',
        },
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
          inverse: '#FFFFFF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(254,44,85,0.25)',
        'glow-brand-lg': '0 0 40px rgba(254,44,85,0.35)',
        'glow-accent': '0 0 20px rgba(37,244,238,0.2)',
        'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        display: ['"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SF Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(254,44,85,0.15)' },
          '100%': { boxShadow: '0 0 40px rgba(254,44,85,0.3)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(135deg, #FE2C55 0%, #FF4D6D 50%, #FE2C55 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config
