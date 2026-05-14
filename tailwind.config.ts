import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      keyframes: {
        "flower-pop": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0)" },
          "30%": { opacity: "1", transform: "translate(calc(-50% + var(--tx) * 0.4), calc(-50% + var(--ty) * 0.4)) scale(1.2)" },
          "100%": { opacity: "0", transform: "translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.6)" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.25)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "flower-pop": "flower-pop 0.8s ease-out forwards",
        "badge-pop": "badge-pop 0.5s ease-out",
      },
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36adf6",
          500: "#0c93e7",
          600: "#0074c5",
          700: "#015da0",
          800: "#064f84",
          900: "#0b426e",
          950: "#072a49",
        },
      },
    },
  },
  plugins: [],
};
export default config;
