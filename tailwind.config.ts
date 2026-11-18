import type { Config } from "tailwindcss";
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { bg: v("bg"), side: v("side"), panel: v("panel"), raise: v("raise"), line: v("line"), fg: v("fg"), mute: v("mute"), dim: v("dim"), accent: v("accent"), ink: v("ink"), ok: v("ok"), warn: v("warn"), danger: v("danger") },
      fontFamily: { sans: ['"Inter Variable"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
