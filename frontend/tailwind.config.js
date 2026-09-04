/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#17252A",
          900: "#17252A",
          800: "#17252A",
          700: "#24383B",
          600: "#365054",
          500: "#537074",
        },
        parchment: "#F3E8D0",
        seal: {
          DEFAULT: "#C49A55",
          bright: "#E4D2B0",
          dim: "#8F6C37",
        },
        signal: {
          ok: "#66734A",
          warn: "#C45F3C",
          bad: "#A74332",
        },
        goa: {
          paper: "#F3E8D0",
          aged: "#E4D2B0",
          teal: "#287C78",
          terracotta: "#C45F3C",
          gold: "#C49A55",
          espresso: "#342A24",
          olive: "#66734A",
        },
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
        sans: ["'Source Sans 3'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
    },
  },
  plugins: [],
};
