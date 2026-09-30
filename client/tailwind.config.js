/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wa-dark': '#0b141a',
        'wa-panel': '#111b21',
        'wa-panel-dark': '#202c33',
        'wa-panel-header': '#202c33',
        'wa-green': '#00a884',
        'wa-green-hover': '#02906f',
        'wa-teal': '#008069',
        'wa-outgoing': '#005c4b',
        'wa-incoming': '#202c33',
        'wa-text-primary': '#e9edef',
        'wa-text-secondary': '#8696a0',
        'wa-text-muted': '#667781',
        'wa-border': '#222d34',
        'wa-border-subtle': '#2a3942',
        'wa-badge': '#25d366',
        'wa-red': '#ea4335'
      },
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.25s ease-out forwards',
        'slide-down': 'slideDown 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
