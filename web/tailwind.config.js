/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e11",
        panel: "#11161c",
        card: "rgba(17, 21, 27, 0.78)",
        accent: "#f0b90b",
        good: "#22c55e",
        bad: "#ef4444"
      },
      boxShadow: {
        soft: "0 10px 40px rgba(0,0,0,.35)"
      },
      borderRadius: {
        xl2: "16px"
      }
    }
  },
  plugins: []
};

