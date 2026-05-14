module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF5FF',
        indigo: '#7C3AED',
        indigoHover: '#6D28D9',
        purple: '#A855F7',
        pink: '#EC4899',
        'card-border': '#E9D5FF',
        'input-border': '#D8B4FE',
        'heading': '#3B0764',
        'main-text': '#4C1D95',
        'light-text': '#7E22CE'
      },
      backgroundImage: {
        'premium-banner': 'linear-gradient(90deg, #7C3AED, #A855F7, #EC4899)'
      }
    }
  },
  plugins: []
};
