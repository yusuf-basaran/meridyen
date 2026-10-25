import { mkdir,writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import { database } from '../lib/supabase.mjs';
import { setupReport } from '../lib/setup.mjs';
const report=await setupReport({env:{...process.env,CLOUDFLARE_ACCOUNT_ID:process.env.CLOUDFLARE_ACCOUNT_ID||config.deployment.cloudflareAccountId},contact:config.contact,checkDatabase:async()=>{
  try{
    const responses=await Promise.all(['sources','articles','pipeline_runs'].map(table=>database().from(table).select('id').limit(1)));
    return responses.every(response=>!response.error);
  }catch{return false;}
}});
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/setup-report.json',JSON.stringify(report,null,2));
const missing=Object.entries(report.credentials).filter(([,ready])=>!ready).map(([name])=>name);
const contacts=Object.entries(report.contactFields).filter(([,ready])=>!ready).map(([name])=>name);
const summary=[`Kurulum: ${report.ready?'hazır':'eksikler var'}`,`Eksik GitHub Secrets: ${missing.join(', ')||'yok'}`,`Eksik künye alanları: ${contacts.join(', ')||'yok'}`,`Veritabanı şeması: ${report.schema}`].join('\n');
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`### Kurulum durumu\n\n${summary.split('\n').map(line=>`- ${line}`).join('\n')}\n`,{flag:'a'});
if(!report.ready&&!process.argv.includes('--report-only'))process.exitCode=1;
