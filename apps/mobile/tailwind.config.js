const { tailwindColors } = require("../../packages/shared/src/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: tailwindColors,
      fontFamily: {
        display: ["Archivo"],
        mono: ["Space Mono"],
      },
    },
  },
  plugins: [],
};
