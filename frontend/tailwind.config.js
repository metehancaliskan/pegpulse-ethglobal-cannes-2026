/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#F4F8FF',
        panel: '#FFFFFF',
        'panel-soft': '#EEF4FF',
        line: 'rgba(15, 23, 42, 0.10)',
        cyan: '#00F5FF',
        royal: '#0033AD',
        success: '#22C55E',
        text: '#0F172A',
        muted: '#5B6B84',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(29, 78, 216, 0.08), 0 20px 60px rgba(15, 23, 42, 0.08)',
        cyan: '0 0 30px rgba(0, 245, 255, 0.12)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at top, rgba(0, 245, 255, 0.14), transparent 34%), radial-gradient(circle at 85% 15%, rgba(0, 51, 173, 0.12), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(238,244,255,0.96))',
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

