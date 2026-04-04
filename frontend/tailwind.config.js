/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0B0E14',
        panel: '#101826',
        'panel-soft': '#131d2d',
        line: 'rgba(148, 163, 184, 0.14)',
        cyan: '#00F5FF',
        royal: '#0033AD',
        success: '#22C55E',
        text: '#E6F3FF',
        muted: '#8FA8C7',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0, 245, 255, 0.14), 0 20px 60px rgba(0, 51, 173, 0.25)',
        cyan: '0 0 40px rgba(0, 245, 255, 0.18)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at top, rgba(0, 245, 255, 0.18), transparent 34%), radial-gradient(circle at 85% 15%, rgba(0, 51, 173, 0.24), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
        'cyan-royal': 'linear-gradient(135deg, #00F5FF 0%, #0033AD 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

