import { colors, spacing, typography, borderRadius, shadows } from './src/styles/design-tokens';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: colors.background,
        text: colors.text,
        brand: colors.brand,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        border: colors.border,
        priority: colors.priority,
        status: colors.status,
        ai: colors.ai,
        milestone: colors.milestone,
      },
      spacing: spacing,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      lineHeight: typography.lineHeight,
      borderRadius: borderRadius,
      boxShadow: shadows,
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
