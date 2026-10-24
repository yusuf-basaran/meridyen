import { config } from '../config.js';
import { database, checked } from './supabase.mjs';
import { dayKey, sanitizeError } from './utils.mjs';

export class ProviderUnavailable extends Error { constructor(message='Kullanılabilir sağlayıcı yok',code='unavailable'){super(message);this.code=code;} }
export function modelFamily(id) {
  const value=id.toLowerCase();
  for(const [pattern,family] of [[/gemini/,'gemini'],[/gpt-oss/,'gpt-oss'],[/llama/,'llama'],[/qwen/,'qwen'],[/deepseek/,'deepseek'],[/mistral|mixtral/,'mistral'],[/gemma/,'gemma'],[/nemotron/,'nemotron']])if(pattern.test(value))return family;
  return null;
}
const catalogCache=new Map();
export async function providerCatalog(provider,{fetcher=fetch}={}) {
  const settings=config.providers[provider];const key=process.env[settings.keyEnv];
  if(provider!=='openrouter'&&!key)throw new ProviderUnavailable('Sağlayıcı anahtarı eksik','configuration');
  const response=await fetcher(`${settings.baseUrl}/models`,{signal:AbortSignal.timeout(15000),headers:provider==='gemini'?{'x-goog-api-key':key}:key?{Authorization:`Bearer ${key}`}:{}});
  if(!response.ok)throw new ProviderUnavailable(`Model listesi HTTP ${response.status}`,'catalog');
  const body=await response.json();
  return provider==='gemini'?(body.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>({id:m.name.replace(/^models\//,''),family:modelFamily(m.name),free:/flash-lite/i.test(m.name)})):(body.data||[]).map(m=>({id:m.id,family:modelFamily(m.id),free:provider==='groq'||(m.id.endsWith(':free')&&Number(m.pricing?.prompt)===0&&Number(m.pricing?.completion)===0)}));
}
async function verifiedModels(provider,fetcher) {
  if(!catalogCache.has(provider))catalogCache.set(provider,await providerCatalog(provider,{fetcher}));
  const catalog=catalogCache.get(provider);
  return config.providers[provider].models.filter(id=>catalog.some(m=>m.id===id&&m.free&&m.family));
}
export function parseJSONResponse(value) {
  if(typeof value!=='string')throw new Error('Boş model yanıtı');
  const cleaned=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return JSON.parse(cleaned);
}
export function createCompleter({fetcher=fetch,reserve=async provider=>checked(await database().rpc('reserve_llm_request',{p_day:dayKey(new Date()),p_provider:provider})),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),getModels=verifiedModels}={}) {
  return async function complete({role,system,user,schema,excludeProviders=[],excludeFamilies=[]}) {
    const chain=config.roles[role];if(!chain)throw new Error('Geçersiz yazım rolü');
    let reason='configuration';
    for(const provider of chain) {
      if(excludeProviders.includes(provider))continue;
      const settings=config.providers[provider];const key=process.env[settings.keyEnv];
      if(!key||!settings.models.length)continue;
      let models;
      try{models=await getModels(provider,fetcher);}catch{reason='catalog';continue;}
      for(const model of models) {
        const family=modelFamily(model);if(!family||excludeFamilies.includes(family))continue;
        for(let attempt=0;attempt<3;attempt++) {
          if(!await reserve(provider)){reason='budget';break;}
          try {
            const gemini=provider==='gemini';
            const url=gemini?`${settings.baseUrl}/models/${encodeURIComponent(model)}:generateContent`:`${settings.baseUrl}/chat/completions`;
            const instructions=system+(schema?`\nÇıktı şeması: ${JSON.stringify(schema)}`:'');
            const payload=gemini?{systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{temperature:0.1,maxOutputTokens:8192,responseMimeType:'application/json'}}:{model,messages:[{role:'system',content:instructions},{role:'user',content:user}],temperature:0.1,max_tokens:8192};
            const response=await fetcher(url,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...(gemini?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`})},body:JSON.stringify(payload)});
            if(!response.ok){reason=response.status===429?'rate_limit':'http';if(response.status!==429&&response.status<500)break;throw new Error(`Sağlayıcı HTTP ${response.status}`);}
            const body=await response.json();
            const raw=gemini?body.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(''):body.choices?.[0]?.message?.content;
            return {data:parseJSONResponse(raw),provider,model,family};
          }catch(error){reason=error instanceof SyntaxError?'invalid_json':reason==='configuration'?'request':reason;if(attempt<2)await sleep(1000*(2**attempt));}
        }
      }
    }
    throw new ProviderUnavailable(`İstek tamamlanamadı (${sanitizeError(reason)})`,reason);
  };
}
export const complete=createCompleter();
