/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // === SEMANTIC GRAYSCALE SYSTEM ===
        
        // Backgrounds (Pure Black → Soft Charcoal)
        'bg-primary': '#000000',      // Pure black - main background
        'bg-secondary': '#0A0A0A',    // Soft black - elevated surfaces
        'bg-tertiary': '#111111',     // Charcoal - cards, containers
        'bg-elevated': '#1A1A1A',     // Elevated panels
        'bg-subtle': '#0F0F0F',       // Subtle backgrounds
        
        // Text Colors (White → Gray → Zinc)
        'text-primary': '#FFFFFF',    // Primary text - headings, emphasis
        'text-secondary': '#EBEBEB',  // Secondary text - body content (improved contrast)
        'text-tertiary': '#B3B3B3',   // Tertiary text - labels, captions (improved contrast)
        'text-muted': '#8C8C8C',      // Muted text - placeholders, hints (improved contrast)
        'text-disabled': '#666666',   // Disabled state text (improved contrast)
        
        // Borders (Subtle → Visible)
        'border-subtle': '#1F1F1F',   // Barely visible borders (improved contrast)
        'border-default': '#2E2E2E',  // Default border color (improved contrast)
        'border-medium': '#4A4A4A',   // Medium emphasis borders (improved contrast)
        'border-strong': '#666666',   // Strong borders (improved contrast)
        'border-accent': '#8C8C8C',   // Accent borders (improved contrast)
        
        // Interactive States
        'interactive-primary': '#FFFFFF',     // Primary interactive (buttons)
        'interactive-secondary': '#E5E5E5',   // Secondary interactive
        'interactive-hover': '#F5F5F5',       // Hover state
        'interactive-active': '#D4D4D4',      // Active/pressed state
        
        // Overlays & Glass
        'overlay-light': 'rgba(255, 255, 255, 0.05)',
        'overlay-medium': 'rgba(255, 255, 255, 0.10)',
        'overlay-strong': 'rgba(255, 255, 255, 0.15)',
        'glass-bg': 'rgba(10, 10, 10, 0.6)',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
        
        // Legacy aliases (for backward compatibility)
        'ai-black': '#000000',
        'ai-dark': '#0A0A0A',
        'ai-gray-900': '#111111',
        'ai-gray-800': '#1A1A1A',
        'ai-gray-700': '#2A2A2A',
        'ai-gray-600': '#404040',
        'ai-gray-500': '#666666',
        'ai-gray-400': '#8C8C8C',
        'ai-gray-300': '#B3B3B3',
        'ai-gray-200': '#D9D9D9',
        'ai-gray-100': '#E6E6E6',
        'ai-white': '#FFFFFF',
      },
      fontSize: {
        // Typography Scale with line heights
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
        '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
      },
      spacing: {
        // Extended spacing scale for better rhythm
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
      },
      borderRadius: {
        // Refined border radius scale
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      borderRadius: {
        // Refined border radius scale
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.5s ease-out',
        'fade-in': 'fade-in 0.6s ease-out',
        'scan': 'scan 3s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-subtle': 'bounce-subtle 0.6s ease-in-out',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scan': {
          '0%, 100%': { transform: 'translateY(-100%)' },
          '50%': { transform: 'translateY(100%)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        // Refined shadow system for depth
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.15)',
        'strong': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        'glow': '0 0 32px rgba(255, 255, 255, 0.1)',
        'glow-strong': '0 0 48px rgba(255, 255, 255, 0.15)',
      },
    },
  },
  plugins: [],
}
