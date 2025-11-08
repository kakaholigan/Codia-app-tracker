// Design Tokens - V10 Professional Theme
export const colors = {
  // Base Palette (Neutral & Professional)
  background: {
    primary: '#F5F7FA',      // Light Gray - Main background
    secondary: '#FFFFFF',    // White - Elevated surfaces (cards, modals)
    tertiary: '#E9EEF3',     // Off-white for subtle differentiation
  },
  text: {
    primary: '#20232A',      // Dark Gray - Headings and primary text
    secondary: '#5A6B83',    // Medium Gray - Body text, descriptions
    tertiary: '#8C9BAB',     // Light Gray - Captions, disabled text
    onPrimary: '#FFFFFF',    // White text on primary color background
  },
  
  // Brand & Accent Colors
  brand: {
    primary: '#2563EB',      // Professional Blue - Primary actions, links
    primaryHover: '#1D4ED8', // Darker blue for hover
    primaryLight: '#DBEAFE', // Light blue for backgrounds/tags
  },
  
  // Semantic Colors (Extended scales for UI components)
  success: {
    50: '#F0FDF4',           // Lightest background
    100: '#DCFCE7',          // Light background
    200: '#BBF7D0',          // Badge background
    500: '#22C55E',          // Default/buttons
    600: '#16A34A',          // Hover state
    700: '#15803D',          // Active/pressed
    900: '#166534',          // Dark text
    default: '#22C55E',      // Alias
    background: '#F0FDF4',   // Alias
    text: '#166534',         // Alias
  },
  warning: {
    50: '#FFFBEB',           // Lightest background
    100: '#FEF3C7',          // Light background
    200: '#FDE68A',          // Badge background
    500: '#F59E0B',          // Default/buttons
    600: '#D97706',          // Hover state
    700: '#B45309',          // Active/pressed
    900: '#78350F',          // Dark text
    default: '#F59E0B',      // Alias
    background: '#FFFBEB',   // Alias
    text: '#B45309',         // Alias
  },
  error: {
    50: '#FEF2F2',           // Lightest background
    100: '#FEE2E2',          // Light background
    200: '#FECACA',          // Badge background
    500: '#EF4444',          // Default/buttons
    600: '#DC2626',          // Hover state
    700: '#B91C1C',          // Active/pressed
    900: '#991B1B',          // Dark text
    default: '#EF4444',      // Alias
    background: '#FEF2F2',   // Alias
    text: '#991B1B',         // Alias
  },
  info: {
    50: '#EFF6FF',           // Lightest background
    100: '#DBEAFE',          // Light background
    200: '#BFDBFE',          // Badge background
    500: '#3B82F6',          // Default/buttons
    600: '#2563EB',          // Hover state
    700: '#1D4ED8',          // Active/pressed
    900: '#1E40AF',          // Dark text
    default: '#3B82F6',      // Alias
    background: '#EFF6FF',   // Alias
    text: '#1E40AF',         // Alias
  },

  // Priority Colors
  priority: {
    high: {
      bg: '#DC2626',         // Red 600
      text: '#FFFFFF',       // White text
      badgeBg: '#FEE2E2',    // Red 100
      badgeText: '#991B1B',  // Red 900
    },
    medium: {
      bg: '#F59E0B',         // Amber 500
      text: '#FFFFFF',       // White text
      badgeBg: '#FEF3C7',    // Amber 100
      badgeText: '#78350F',  // Amber 900
    },
    low: {
      bg: '#9CA3AF',         // Gray 400
      text: '#FFFFFF',       // White text
      badgeBg: '#F3F4F6',    // Gray 100
      badgeText: '#374151',  // Gray 700
    },
  },

  // Status Colors
  status: {
    pending: {
      bg: '#9CA3AF',         // Gray 400
      text: '#111827',       // Gray 900
      badgeBg: '#F3F4F6',    // Gray 100
      badgeText: '#374151',  // Gray 700
      light: '#F9FAFB',      // Gray 50
    },
    inProgress: {
      bg: '#3B82F6',         // Blue 500
      text: '#1E3A8A',       // Blue 900
      badgeBg: '#DBEAFE',    // Blue 100
      badgeText: '#1E40AF',  // Blue 900
      light: '#EFF6FF',      // Blue 50
      border: '#60A5FA',     // Blue 400
    },
    done: {
      bg: '#22C55E',         // Green 500
      text: '#14532D',       // Green 900
      badgeBg: '#DCFCE7',    // Green 100
      badgeText: '#166534',  // Green 900
      light: '#F0FDF4',      // Green 50
      border: '#4ADE80',     // Green 400
    },
    blocked: {
      bg: '#EF4444',         // Red 500
      text: '#7F1D1D',       // Red 900
      badgeBg: '#FEE2E2',    // Red 100
      badgeText: '#991B1B',  // Red 900
      light: '#FEF2F2',      // Red 50
      border: '#F87171',     // Red 400
    },
  },

  // AI & Milestone Colors
  ai: {
    primary: '#A855F7',      // Purple 500
    light: '#F3E8FF',        // Purple 50
    bg: '#E9D5FF',           // Purple 100
    text: '#6B21A8',         // Purple 800
    border: '#C084FC',       // Purple 400
  },
  milestone: {
    primary: '#F59E0B',      // Amber 500
    light: '#FFFBEB',        // Amber 50
    bg: '#FEF3C7',           // Amber 100
    text: '#78350F',         // Amber 900
    border: '#FBBF24',       // Amber 400
    accent: '#FB923C',       // Orange 400
  },
  
  // UI Elements
  border: {
    default: '#D1D9E2',      // Default borders for inputs, cards
    subtle: '#E9EEF3',       // Lighter borders for dividers
  },
  
  // Interactive States
  hover: {
    surface: '#F5F7FA',      // For hovering over list items, etc.
  },
  
  // Glassmorphism
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.10)',
    strong: 'rgba(255, 255, 255, 0.15)',
  },
};

// Spacing Scale (8px grid system - SaaS standard)
export const spacing = {
  0: '0',           // 0px
  1: '0.25rem',     // 4px - tight spacing
  2: '0.5rem',      // 8px - base unit
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px - standard spacing
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px - section spacing
  8: '2rem',        // 32px - large spacing
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px - extra large
  16: '4rem',       // 64px
};

// Typography Scale (SaaS Dashboard Standard 2024)
export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    caption: '0.75rem',      // 12px - Helper text, captions
    body: '0.875rem',        // 14px - Body text, labels
    bodyLarge: '1rem',       // 16px - Large body, card content
    cardTitle: '1.125rem',   // 18px - Card/widget titles
    heading: '1.25rem',      // 20px - Section headings
    headingLarge: '1.5rem',  // 24px - Large section headings
    pageTitle: '2rem',       // 32px - Page titles
    display: '2.25rem',      // 36px - Hero/display text
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,      // Headings
    normal: 1.4,     // Body text
    relaxed: 1.5,    // Comfortable reading
  },
};

// Shadows (Tailwind + Material Design 3 standard)
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',                    // Subtle borders
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',                // Standard cards
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',                  // Dropdowns, modals
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',                // Large popovers
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',                // Hero surfaces
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',           // Maximum elevation
  // Colored shadows for neon effects
  neon: {
    blue: '0 0 20px rgba(30, 144, 255, 0.3)',
    green: '0 0 20px rgba(0, 255, 133, 0.3)',
    pink: '0 0 20px rgba(255, 0, 153, 0.3)',
  },
};

// Border Radius (Tailwind + Material Design 3 standard)
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px - subtle rounding
  default: '0.25rem', // 4px - small buttons
  md: '0.375rem',   // 6px - inputs
  lg: '0.5rem',     // 8px - cards (most common)
  xl: '0.75rem',    // 12px - large cards
  '2xl': '1rem',    // 16px - modals, nav bars
  '3xl': '1.5rem',  // 24px - hero elements
  full: '9999px',   // Pills, circles
};

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};

// Component Sizing Standards (SaaS Dashboard 2024)
export const componentSizes = {
  // Cards
  card: {
    minWidth: '320px',
    maxWidth: '400px',
    minHeight: '120px',
    padding: `${spacing[6]} ${spacing[8]}`,      // 24px top/bottom, 32px left/right
    gap: spacing[4],                              // 16px between elements
  },
  // Buttons
  button: {
    height: {
      small: '36px',
      medium: '44px',
      large: '48px',
    },
    minWidth: '120px',
    padding: `${spacing[2]} ${spacing[6]}`,       // 8px top/bottom, 24px left/right
    gap: spacing[2],                              // 8px between buttons
  },
  // Icons
  icon: {
    small: '16px',        // Inline/contextual
    medium: '20px',       // In-card/action icons
    large: '24px',        // Primary dashboard/menu
    padding: spacing[2],  // 8px minimum around icons
  },
  // Inputs
  input: {
    height: '44px',
    padding: `${spacing[2]} ${spacing[4]}`,
    gap: spacing[4],      // 16px between form elements
  },
  // Modals
  modal: {
    width: {
      small: '480px',
      medium: '640px',
      large: '800px',
    },
    padding: spacing[8],  // 32px inside modal
    gap: spacing[6],      // 24px between content blocks
  },
};

// Layout Grid System (12-column responsive)
export const grid = {
  columns: 12,
  gutter: spacing[6],     // 24px
  margin: {
    desktop: spacing[8],  // 32px
    tablet: spacing[6],   // 24px
    mobile: spacing[4],   // 16px
  },
  breakpoints: {
    mobile: '375px',
    tablet: '768px',
    laptop: '1024px',
    desktop: '1440px',
    wide: '1920px',
  },
};

// Component-specific tokens
export const components = {
  header: {
    height: '4rem', // 64px
    background: colors.glass.medium,
    border: colors.border.subtle,
  },
  card: {
    background: colors.background.tertiary,
    border: colors.border.default,
    borderRadius: borderRadius.lg,
    shadow: shadows.md,
    padding: componentSizes.card.padding,
  },
  button: {
    primary: {
      background: colors.brand.primary,
      color: colors.text.primary,
      hover: colors.hover.primary,
      height: componentSizes.button.height.medium,
    },
    secondary: {
      background: colors.background.secondary,
      color: colors.text.secondary,
      hover: colors.hover.surface,
      height: componentSizes.button.height.medium,
    },
  },
};
