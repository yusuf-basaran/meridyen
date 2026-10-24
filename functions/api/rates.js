import { config } from '../../config.js';

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL('/api/rates',request.url),{method:'GET'});
  const cached = await cache.match(key);
  if(cached)return cached;
  const read=async url=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});if(!response.ok)return null;return await response.json();}catch{return null;}};
  const [fx,crypto]=await Promise.allSettled([read(config.endpoints.fx),read(config.endpoints.crypto)]);
  const fxData=fx.status==='fulfilled'?fx.value:null;
  const cryptoData=crypto.status==='fulfilled'?crypto.value:null;
  const usd=Number(fxData?.rates?.TRY),eurBase=Number(fxData?.rates?.EUR),btc=Number(cryptoData?.bitcoin?.try);
  const positive=value=>Number.isFinite(value)&&value>0?value:null;
  const body={usd:positive(usd),eur:positive(usd/eurBase),btc:positive(btc),updatedAt:new Date().toISOString(),fxDate:fxData?.date||null};
  const response=new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  waitUntil(cache.put(key,response.clone()));
  return response;
}
export function onRequestOptions(){return new Response(null,{status:405,headers:{Allow:'GET'}});}
