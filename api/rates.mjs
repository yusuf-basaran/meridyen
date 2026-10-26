import { ratesResponse } from '../lib/rates.mjs';

export async function GET() {
  const response = await ratesResponse();
  response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=300');
  return response;
}
