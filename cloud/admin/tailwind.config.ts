import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0f16",
        panel: "rgba(11, 18, 31, 0.78)",
        card: "rgba(255,255,255,0.045)",
        border: "rgba(255,255,255,0.11)",
        text: "rgba(255,255,255,0.92)",
        dim: "rgba(255,255,255,0.70)",
        mute: "rgba(255,255,255,0.50)",
        accent: "#f0b90b"
      },
      boxShadow: {
        soft: "0 20px 55px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;
