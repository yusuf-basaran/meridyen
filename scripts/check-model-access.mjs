import { mkdir, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import { providerCatalog } from '../lib/llm.mjs';
import { sanitizeError } from '../lib/utils.mjs';

const report={checkedAt:new Date().toISOString(),generationRequested:false,autoPublish:false,providers:{}};
for(const [provider,settings] of Object.entries(config.providers)){
  if(!process.env[settings.keyEnv]){report.providers[provider]={status:'missing_key',models:[]};continue;}
  try{
    const catalog=await providerCatalog(provider);
    const models=catalog.filter(model=>model.free&&model.family).map(model=>model.id);
    report.providers[provider]={status:models.length?'catalog_verified':'no_approved_free_model',models};
  }catch(error){report.providers[provider]={status:'unavailable',error:sanitizeError(error),models:[]};}
}
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/model-access.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  await writeFile(process.env.GITHUB_STEP_SUMMARY,`## Model bağlantısı\n\n${Object.entries(report.providers).map(([name,value])=>`- ${name}: ${value.status}${value.models.length?` (${value.models.join(', ')})`:''}`).join('\n')}\n\nYalnızca model kataloğu sorgulandı; içerik üretimi veya canlı teyit yapılmadı. Otomatik yayın kapalıdır.\n`);
}
