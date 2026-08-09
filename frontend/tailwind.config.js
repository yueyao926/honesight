/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core neutrals carry most of the interface.
        white: "#F3F2EC",
        black: "#272522",
        ink: "#272522",
        muted: "#70756F",
        fog: "#8A8F88",
        cream: "#F3F2EC",
        blush: "#E5E5DF",
        sand: "#D2D2CA",
        neutral: {
          100: "#E5E5DF",
          900: "#272522",
        },

        // Coffee is the primary interaction color.
        brand: "#715A4A",
        "brand-deep": "#554235",
        coffee: "#715A4A",
        "coffee-soft": "#C7B9AD",

        // Green stays limited to small accents and success states.
        accent: "#31443B",
        matcha: "#A7B58A",
        sage: "#A7B58A",

        // Soft focus rings and decorative washes stay warm-neutral, not pink.
        rose: "#C7B9AD",

        // Error and destructive states use legible coffee-derived tones.
        red: {
          50: "#EEE9E5",
          200: "#CBBEB4",
          300: "#B5A69B",
          500: "#715A4A",
          600: "#634D40",
          700: "#554235",
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        logo: ['"Amatic SC"', '"JasonHandwriting"', "cursive"],
        handwrite: ['"JasonHandwriting"', '"Amatic SC"', "cursive"],
        hand: ['"Caveat"', "cursive"],
      },
      boxShadow: {
        soft: "0 20px 60px rgba(113, 90, 74, 0.12)",
        card: "0 8px 32px rgba(39, 37, 34, 0.07)",
        glow: "0 0 40px rgba(113, 90, 74, 0.18)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        wobble: "wobble 4.5s ease-in-out infinite",
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
        wobble: {
          "0%, 100%": { transform: "rotate(0deg) translateY(0)" },
          "25%": { transform: "rotate(-5deg) translateY(-4px)" },
          "50%": { transform: "rotate(4deg) translateY(2px)" },
          "75%": { transform: "rotate(-3deg) translateY(-2px)" },
        },
      },
    },
  },
  plugins: [],
};
