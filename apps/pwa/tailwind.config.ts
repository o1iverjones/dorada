import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#0e402d", light: "#e8f0ec" },
        sage: "#5a6650",
        lime: "#9fcc2e",
        surface: "#ffffff",
        ground: "#f4f5f2",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
