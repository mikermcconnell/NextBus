/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'transit-blue': '#005DAA',
        'transit-gray': '#4A4A4A',
        'barrie-blue': 'rgb(0,74,128)',
      },
    },
  },
  plugins: [],
} 