/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A2947",
          900: "#0A2947",
          800: "#0A2947",
          700: "#0A2947",
          600: "#0A2947",
          500: "#0A2947",
        },
        parchment: "#F3E4C9",
        seal: {
          DEFAULT: "#F3E4C9",
          bright: "#D3D4C0",
          dim: "#8B5E3C",
        },
        signal: {
          ok: "#D3D4C0",
          warn: "#F3E4C9",
          bad: "#F0B38A",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
    },
  },
  plugins: [],
};
