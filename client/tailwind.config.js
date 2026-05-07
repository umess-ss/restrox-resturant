/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e85d04', light: '#f48c06', dark: '#9d0208' },
        surface: '#1a1a2e',
      },
    },
  },
  plugins: [],
};
