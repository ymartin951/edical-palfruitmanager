/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F7F3D7',
          text: '#080F03',
          primary: '#16460A',
          'primary-dark': '#080F03',
          secondary: '#697D17',
          gold: '#F0C338',
          orange: '#E6890B',
          red: '#C2280B',
          brown: '#541C03',
          muted: '#A39A66',
        },
      },
    },
  },
  plugins: [],
};
