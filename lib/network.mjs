import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPrivateIP(ip) {
  if (ip.includes(':')) return ip === '::1' || ip === '::' || /^f[cd]|^fe[89ab]/i.test(ip) || /^::ffff:/i.test(ip);
  const [a,b] = ip.split('.').map(Number);
  return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19));
}
export async function publicURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Yalnızca herkese açık HTTPS adresleri kullanılabilir');
  if (['localhost','localhost.localdomain'].includes(url.hostname) || url.hostname.endsWith('.local')) throw new Error('Yerel adres kullanılamaz');
  const host = url.hostname.replace(/^\[|\]$/g,'');
  const addresses = isIP(host) ? [{ address:host }] : await lookup(host,{all:true});
  if (!addresses.length || addresses.some(a=>isPrivateIP(a.address))) throw new Error('Özel ağ adresi kullanılamaz');
  return url;
}
export async function fetchPublic(url, options = {}) {
  let current = url;
  const signal = options.signal || AbortSignal.timeout(10000);
  for (let hop=0;hop<5;hop++) {
    await publicURL(current);
    const response = await fetch(current,{...options,signal,redirect:'manual'});
    if ([301,302,303,307,308].includes(response.status)) { current = new URL(response.headers.get('location'),current).href; continue; }
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    return response;
  }
  throw new Error('Çok fazla yönlendirme');
}
export async function limitedText(response, maxBytes=2000000) {
  if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Yanıt boyutu sınırı aşıldı');
  const reader=response.body.getReader();let count=0;const parts=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>maxBytes)throw new Error('Yanıt boyutu sınırı aşıldı');parts.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(parts).toString('utf8');
}
