import type { Config } from 'tailwindcss'
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     '#0A0D12',
        surface: '#121722',
        border:  'rgba(255,255,255,0.07)',
        primary: '#3B82F6',
        success: '#22C55E',
        danger:  '#EF4444',
        muted:   '#94A3B8',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up 0.18s ease-out',
        'fade-in':  'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
