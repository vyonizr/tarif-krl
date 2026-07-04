const colors = require('tailwindcss/colors')

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
        brand: {
          text: colors.slate['800'],
          muted: colors.slate['500'],
          surface: {
            DEFAULT: colors.white,
            muted: colors.slate['100'],
          },
          accent: colors.amber,
          danger: colors.red['500'],
        },
      },
      borderRadius: {
        control: '0.375rem',
        pill: '9999px',
      },
      height: {
        screen: 'calc(var(--vh) * 100)',
      },
      minHeight: {
        screen: 'calc(var(--vh) * 100)',
      },
    },
  },
  plugins: [],
}
