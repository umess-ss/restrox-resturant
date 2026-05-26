/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e85d04', light: '#f48c06', dark: '#9d0208' },
        surface: '#1a1a2e',
        restrox: {
          surface: '#f8f9ff',
          cream: '#fff8ec',
          azure: '#eff7ff',
          'azure-strong': '#d9eaf6',
          mint: '#d2e8d4',
          green: '#006a43',
          'green-dark': '#005233',
          ink: '#121c2a',
          muted: '#5f6f66',
          border: '#e5e7eb',
        },
      },
      boxShadow: {
        restrox: '0 4px 15px rgba(31, 41, 55, 0.04)',
        'restrox-lg': '0 10px 30px rgba(31, 41, 55, 0.08)',
        'restrox-xl': '0 40px 80px -15px rgba(31, 41, 55, 0.14)',
      },
    },
  },
  plugins: [],
};
