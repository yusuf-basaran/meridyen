import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { config } from '../config.js';
import { providerCatalog } from '../lib/llm.mjs';
import { fetchFeed } from '../lib/rss.mjs';
import { sanitizeError } from '../lib/utils.mjs';

const discover=process.argv.includes('--discover');
const checkFeeds=process.argv.includes('--feeds');
const report={checkedAt:new Date().toISOString(),providers:{},feeds:[],rates:{}};
let source=await readFile(new URL('../config.js',import.meta.url),'utf8');
for(const [provider,settings] of Object.entries(config.providers)){
  if(provider!=='openrouter'&&!process.env[settings.keyEnv]){report.providers[provider]={status:'missing_key',models:[]};continue;}
  try{
    const catalog=await providerCatalog(provider);
    let selected=settings.models;
    if(discover){
      const candidates=catalog.filter(m=>m.free&&m.family&&(provider!=='gemini'||/flash-lite/i.test(m.id)));
      const families=new Set();selected=[];
      for(const model of candidates){if(provider==='openrouter'&&families.has(model.family))continue;selected.push(model.id);families.add(model.family);if(selected.length>=(provider==='openrouter'?3:1))break;}
      const line=new RegExp(`(${provider}: \\{[^\\n]*models: )\\[[^\\n]*?\\]`);
      source=source.replace(line,`$1${JSON.stringify(selected)}`);
    }
    report.providers[provider]={status:selected.length&&selected.every(id=>catalog.some(m=>m.id===id&&m.free&&m.family))?'verified':'needs_configuration',models:selected};
  }catch(error){report.providers[provider]={status:'unavailable',error:sanitizeError(error)};}
}
if(discover)await writeFile(new URL('../config.js',import.meta.url),source);
if(checkFeeds){
  const sources=JSON.parse(await readFile(new URL('../sources.json',import.meta.url),'utf8'));
  for(const source of sources){try{const items=await fetchFeed(source.feed_url);report.feeds.push({name:source.name,url:source.feed_url,available:true,items:items.length});}catch(error){report.feeds.push({name:source.name,url:source.feed_url,available:false,error:sanitizeError(error)});}}
}
for(const name of ['fx','crypto']){try{const response=await fetch(config.endpoints[name],{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();const valid=name==='fx'?Number.isFinite(data.rates?.TRY)&&Number.isFinite(data.rates?.EUR):Number.isFinite(data.bitcoin?.try);report.rates[name]={available:valid};}catch(error){report.rates[name]={available:false,error:sanitizeError(error)};}}
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/preflight.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
