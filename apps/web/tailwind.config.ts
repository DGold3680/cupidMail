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
        mono: ["var(--font-space-mono)", "Space Mono", "monospace"],
        heading: ["var(--font-space-mono)", "Space Mono", "sans-serif"],
      },
      colors: {
        cupid: {
          50: "#fff1f3",
          100: "#ffe4e8",
          200: "#fecdd6",
          300: "#fda4b4",
          400: "#fb718d",
          500: "#f43f68",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
          950: "#4c0519",
        },
        cream: {
          50: "#fdfcf9",
          100: "#fbf8f1",
          200: "#f4ede0",
          300: "#ebdcc9",
          400: "#dec6aa",
          500: "#ccac87",
          600: "#b59168",
          700: "#967550",
          800: "#795e40",
          900: "#604b34",
          950: "#38291a",
        },
        parchment: {
          DEFAULT: "#FAF7F2",
          surface: "#FFFDFB",
          border: "#EFE8DE",
          muted: "#8C7E78",
          dark: "#2A221F",
        },
      },
      boxShadow: {
        cupid: "0 4px 20px -2px rgba(136, 19, 55, 0.15)",
        "cupid-lg": "0 10px 30px -4px rgba(136, 19, 55, 0.22)",
      },
    },
  },
  plugins: [],
};
export default config;
