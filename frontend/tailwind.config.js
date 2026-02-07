/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
        display: ['Fredoka', 'sans-serif'],
      },
      colors: {
        candy: {
          pink: '#f472b6',
          purple: '#a78bfa',
          yellow: '#fbbf24',
          mint: '#34d399',
          blue: '#60a5fa',
        },
        paper: '#fffbeb',
        'paper-dark': '#1a1a2e',
        'card-dark': '#252542',
        'surface-dark': '#16162a',
      },
      borderRadius: {
        '4xl': '2.5rem',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      }
    },
  },
  plugins: [],
}
