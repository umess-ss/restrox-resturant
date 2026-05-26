/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e85d04', light: '#f48c06', dark: '#9d0208' },
        surface: '#1a1a2e',
        restrox: {
          surface: '#fffbf5',
          cream: '#fff7ed',
          azure: '#fff7ed',
          'azure-strong': '#fed7aa',
          orange: '#f97316',
          'orange-dark': '#ea580c',
          'orange-light': '#ffedd5',
          ink: '#111827',
          muted: '#6b7280',
          border: '#e5e7eb',
          'border-warm': '#fed7aa',
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
