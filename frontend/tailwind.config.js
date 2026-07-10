/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#3D3530",
        muted: "#A69B94",
        brand: "#D4A5A5",
        "brand-deep": "#C4898E",
        cream: "#FAF7F2",
        blush: "#F5E6E0",
        sand: "#EDE4DA",
        rose: "#E8C4C4",
        sage: "#B8C4B0",
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 60px rgba(212, 165, 165, 0.12)",
        card: "0 8px 32px rgba(61, 53, 48, 0.06)",
        glow: "0 0 40px rgba(232, 196, 196, 0.35)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
