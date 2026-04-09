/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        bg:        '#1a1a2e',
        card:      '#16213e',
        accent:    '#0f3460',
        highlight: '#e94560',
        teal:      '#4ecdc4',
        sky:       '#45b7d1',
        muted:     '#aaaaaa',
      },
    },
  },
  plugins: [],
};
