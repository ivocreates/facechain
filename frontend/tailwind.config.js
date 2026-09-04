/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0E13",
          900: "#10141B",
          800: "#161B24",
          700: "#1E2530",
          600: "#2A3341",
          500: "#3D4A5C",
        },
        parchment: "#EDE7D9",
        seal: {
          DEFAULT: "#C9A038",
          bright: "#E8C468",
          dim: "#8A6E28",
        },
        signal: {
          ok: "#5FB88A",
          warn: "#D98A3D",
          bad: "#C7594C",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(237,231,217,0.045) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
