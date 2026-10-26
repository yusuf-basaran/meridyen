import { ratesResponse } from '../../lib/rates.mjs';

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL('/api/rates',request.url),{method:'GET'});
  const cached = await cache.match(key);
  if(cached)return cached;
  const response=await ratesResponse();
  waitUntil(cache.put(key,response.clone()));
  return response;
}
export function onRequestOptions(){return new Response(null,{status:405,headers:{Allow:'GET'}});}
