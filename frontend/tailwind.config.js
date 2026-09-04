/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B3D25",
          900: "#0E4A2D",
          800: "#125638",
          700: "#1B6944",
          600: "#277D52",
          500: "#3B9264",
        },
        parchment: "#F4ECD8",
        seal: {
          DEFAULT: "#F0C419",
          bright: "#FFE07A",
          dim: "#B9860F",
        },
        signal: {
          ok: "#2FA76B",
          warn: "#D98A2B",
          bad: "#D1483A",
        },
        goa: {
          paper: "#F4ECD8",
          aged: "#E4D2B0",
          teal: "#2BA6A6",
          terracotta: "#E4147C",
          gold: "#F0C419",
          espresso: "#241C15",
          olive: "#2FA76B",
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
