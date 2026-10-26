import { config } from '../config.js';

export async function ratesResponse() {
  const read = async url => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  };
  const [fx, crypto] = await Promise.all([read(config.endpoints.fx), read(config.endpoints.crypto)]);
  const usd = Number(fx?.rates?.TRY), eurBase = Number(fx?.rates?.EUR), btc = Number(crypto?.bitcoin?.try);
  const positive = value => Number.isFinite(value) && value > 0 ? value : null;
  return Response.json({ usd: positive(usd), eur: positive(usd / eurBase), btc: positive(btc), updatedAt: new Date().toISOString(), fxDate: fx?.date || null }, {
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' }
  });
}
