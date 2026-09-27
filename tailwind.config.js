/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-solid': 'var(--surface-solid)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        purple: {
          light: '#D8B4FE',
          DEFAULT: '#A855F7',
          dark: '#7C3AED',
        },
        red: {
          light: '#FFE4E6',
          DEFAULT: '#E11D48',
          dark: '#9F1239',
        },
        accent: 'var(--accent)',
        warm: 'var(--warm)',
        danger: 'var(--danger)',
        ok: 'var(--ok)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans JP"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '20px',
        'xl': '28px',
      },
      backdropBlur: {
        'glass': '20px',
        'glass-strong': '28px',
      },
    },
  },
  plugins: [],
}
