/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B8C5A',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#E8DECD',
          foreground: '#2C3E2F',
        },
        accent: {
          DEFAULT: '#D4C5A9',
          foreground: '#2C3E2F',
        },
        background: '#F9F7F4',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#2C3E2F',
        },
        foreground: '#2C3E2F',
        muted: {
          DEFAULT: '#7A8F7D',
          foreground: '#FFFFFF',
        },
        success: '#6B9F6A',
        destructive: {
          DEFAULT: '#C85A54',
          foreground: '#FFFFFF',
        },
        gold: '#C9A961',
        border: '#E8DECD',
        input: '#E8DECD',
        ring: '#5B8C5A',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        arabic: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
