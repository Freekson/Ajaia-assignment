import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17221d",
        paper: "#f7f8f4",
        brand: { DEFAULT: "#2f6b4f", dark: "#23513c", soft: "#e3eee7" },
      },
      boxShadow: { card: "0 12px 35px rgba(25, 45, 35, 0.08)" },
    },
  },
  plugins: [],
} satisfies Config;
