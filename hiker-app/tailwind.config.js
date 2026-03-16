/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2d5a3d',
        secondary: '#5c8a6b',
        accent: '#9cb98f',
      },
    },
  },
  plugins: [],
}
