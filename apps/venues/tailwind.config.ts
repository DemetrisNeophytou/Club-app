import type { Config } from "tailwindcss";
import { tailwindColors } from "@portal/shared";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tailwindColors,
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
