import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        panel: "rgba(15, 23, 42, 0.7)",
        card: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.10)",
        text: "rgba(255,255,255,0.92)",
        dim: "rgba(255,255,255,0.70)",
        mute: "rgba(255,255,255,0.50)",
        accent: "#f0b90b"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;

