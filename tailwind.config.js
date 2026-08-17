export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pink: { 500: '#EC4899', 600: '#DB2777' },
        brand: '#EC4899',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        // Readings — every number on the desk. DM Mono is already fetched by
        // index.css and was going unused; a mono next to Outfit says "this is
        // a measurement, not a headline", and keeps digits from reflowing as
        // they count up.
        meter: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
