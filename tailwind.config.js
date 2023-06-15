/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
    height: theme => ({
      ...theme,
      screen: 'calc(var(--vh) * 100)',
    }),
    minHeight: theme => ({
      ...theme,
      screen: 'calc(var(--vh) * 100)',
    }),
  },
  plugins: [],
}
