/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "sidebar-bg": "#1e293b",
        "sidebar-hover": "#334155",
        "sidebar-active": "#1e40af",
        "sidebar-text": "#cbd5e1",
      },
    },
  },
  plugins: [],
};
