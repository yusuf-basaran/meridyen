export const SITE_NAME = 'Meridyen Haber';
export const TIMEZONE = 'Europe/Istanbul';
export const CATEGORIES = ['Gündem', 'Ekonomi', 'Dünya', 'Spor', 'Teknoloji', 'Bilim', 'Sağlık'];
export const CATEGORY_SLUGS = ['gundem', 'ekonomi', 'dunya', 'spor', 'teknoloji', 'bilim', 'saglik'];
export const AUTO_PUBLISH = false;
export const ADS_ENABLED = false;
export const config = {
  pageSize: 20,
  maxNewItems: 10,
  batchSize: 5,
  dailyLimit: 800,
  feedTimeoutMs: 10000,
  minExcerptLength: 100,
  crossSourceHours: 12,
  crossSourceThreshold: 0.5,
  crossSourceMinWords: 3,
  scoreThreshold: 80,
  archiveAfterFiles: 18000,
  socialHourlyLimit: 6,
  contact: { owner: '', email: '', address: '' },
  providers: {
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyEnv: 'GEMINI_API_KEY', models: [] },
    groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', models: [] },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', models: ["nvidia/nemotron-3.5-super-vl:free","google/gemma-4-26b-a4b-it:free"] }
  },
  roles: { writer: ['gemini', 'groq', 'openrouter'], reviewer1: ['groq'], reviewer2: ['openrouter'] },
  endpoints: {
    fx: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,TRY',
    crypto: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try',
    telegram: 'https://api.telegram.org',
    bluesky: 'https://bsky.social/xrpc'
  },
  evaluationMaxAgeDays: 30
};
