module.exports = {
  content: ['./src/**/*.{html,ts}'], // <- ceci est crucial
  theme: {
    extend: {
      colors: {
        neon: '#00ffff',
      },
      boxShadow: {
        glow: '0px 0px 15px 2px rgba(0, 255, 255, 0.8)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out both',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
