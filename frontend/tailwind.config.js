/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        muted: "#6d7973",
        brand: "#1f7a5b",
        soft: "#e8f4ee",
      },
      boxShadow: {
        soft: "0 18px 55px rgba(31, 122, 91, 0.08)",
      },
    },
  },
  plugins: [],
};
