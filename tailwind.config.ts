import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          background: "var(--card-background)",
          border: "var(--card-border)",
        },
        highlight: "var(--highlight)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        }
      },
    },
  },
  plugins: [],
} satisfies Config;
