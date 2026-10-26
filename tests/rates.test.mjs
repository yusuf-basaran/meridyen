import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/rates.js';
import { GET } from '../api/rates.mjs';

test('Kur uç noktası çapraz kuru hesaplar, beş dakika önbellekler ve hata durumunda null döndürür',async()=>{
  const realFetch=globalThis.fetch,realCaches=globalThis.caches;let stored;let calls=0;
  globalThis.caches={default:{match:async()=>stored?.clone(),put:async(_key,response)=>{stored=response;}}};
  globalThis.fetch=async url=>{calls++;return Response.json(String(url).includes('frankfurter')?{rates:{TRY:40,EUR:.8},date:'2026-10-23'}:{bitcoin:{try:4000000}});};
  try{
    const pending=[];const context={request:new Request('https://example.invalid/api/rates'),waitUntil:promise=>pending.push(promise)};
    const response=await onRequestGet(context);const data=await response.json();assert.equal(data.usd,40);assert.equal(data.eur,50);assert.equal(data.btc,4000000);assert.equal(response.headers.get('Cache-Control'),'public, max-age=300');await Promise.all(pending);
    assert.equal((await (await onRequestGet(context)).json()).usd,40);assert.equal(calls,2);
    stored=undefined;globalThis.fetch=async()=>{throw new Error('network');};
    const fallback=await (await onRequestGet(context)).json();assert.equal(fallback.usd,null);assert.equal(fallback.eur,null);assert.equal(fallback.btc,null);
  }finally{globalThis.fetch=realFetch;globalThis.caches=realCaches;}
});

test('Vercel kur uç noktası Cloudflare Cache API gerektirmeden çalışır ve CDN önbelleği belirtir', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => Response.json(String(url).includes('frankfurter') ? { rates: { TRY: 40, EUR: .8 }, date: '2026-10-26' } : { bitcoin: { try: 4000000 } });
  try {
    const response = await GET();
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'public, s-maxage=300');
    const data = await response.json();
    assert.equal(data.eur, 50);
    assert.equal(data.fxDate, '2026-10-26');
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
    const unavailable = await (await GET()).json();
    assert.equal(unavailable.usd, null);
    assert.equal(unavailable.btc, null);
  } finally { globalThis.fetch = realFetch; }
});
