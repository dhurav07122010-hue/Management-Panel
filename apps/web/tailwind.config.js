/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mc: {
          green: '#22c55e',
          darkgreen: '#15803d',
          dirt: '#5c4033',
          stone: '#374151',
          obsidian: '#0f172a',
          diamond: '#38bdf8',
          gold: '#eab308',
          redstone: '#ef4444'
        }
      }
    },
  },
  plugins: [],
};
