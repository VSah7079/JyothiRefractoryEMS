module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        indigo: '#6366F1',
        indigoHover: '#4F46E5',
        purple: '#8B5CF6',
        pink: '#EC4899',
        'card-border': '#E2E8F0',
        'input-border': '#E2E8F0',
        'main-text': '#0F172A',
        'small-text': '#64748B'
      },
      backgroundImage: {
        'premium-banner': 'linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899)'
      }
    }
  },
  plugins: []
};
