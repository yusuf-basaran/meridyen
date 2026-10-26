export function resolveSiteURL(env = process.env) {
  const explicit = env.SITE_URL?.trim();
  const hostname = env.VERCEL_ENV === 'production'
    ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    : env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = explicit || (env.VERCEL === '1' && hostname ? `https://${hostname}` : '');
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw new Error('SITE_URL geçerli bir HTTPS adresi olmalıdır.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL yalnızca HTTPS site kök adresini içermelidir.');
  }
  return url.origin;
}

export function vercelBuildMode(env = process.env) {
  const mode = env.MERIDYEN_BUILD_MODE || 'launch';
  if (!['launch', 'production'].includes(mode)) throw new Error('MERIDYEN_BUILD_MODE: launch veya production olmalıdır.');
  return mode;
}
