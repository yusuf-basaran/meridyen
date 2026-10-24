import { mkdir,writeFile } from 'node:fs/promises';
import { cases } from './cases.mjs';
import { complete } from '../../lib/llm.mjs';
import { ruleCheck,decision,reviewBatch } from '../verify.mjs';
import { evaluationFingerprint } from '../../lib/evaluation-gate.mjs';
import { chunk } from '../../lib/utils.mjs';

const live=process.argv.includes('--live');
if(live&&!['GEMINI_API_KEY','GROQ_API_KEY','OPENROUTER_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].every(key=>process.env[key]))throw new Error('Canlı değerlendirme için sağlayıcı anahtarları ve Supabase bağlantısı gerekir.');
// Yerel çalışmada yalnızca taşıma, şema ve karar akışı denetlenir.
const simulated=async({role,user})=>({provider:role==='reviewer1'?'groq':'openrouter',model:'test-double',family:role==='reviewer1'?'llama':'qwen',data:JSON.parse(user).map(({source,article})=>{
  const output=`${article.title} ${article.summary} ${article.body}`;
  const unsupported=/72 lira|Cem Arı|Her başvuru kabul edilecek|iptal edildi|trafik tamamen bitti|25 Ekim|zorunlu tutuldu|sadece internet|12 Kasım|özel bir şirkete devretti/.test(output)&&!source.excerpt.includes(output);
  return {verdict:unsupported?'fail':'pass',score:unsupported?25:95,issues:unsupported?[{text:'Kaynağın desteklemediği ifade.',type:'uydurma',severity:'yuksek'}]:[]};
})});
const reports=[];
for(const batch of chunk(cases,5)){
  const evaluated=await reviewBatch(batch.map(c=>c.article),live?complete:simulated);
  for(let i=0;i<batch.length;i++){
    const sample=batch[i],result=evaluated[i],rules=ruleCheck(sample.article);
    const outcome=decision({...result,rules,corroborating:[],trustLevel:3,writer:{provider:'gemini',family:'gemini',model:'fixture'}});
    reports.push({id:sample.id,expected:sample.expected,verdict:outcome.verdict,rules,reviewer1:result.reviewer1,reviewer2:result.reviewer2});
  }
}
const good=reports.filter(r=>r.expected==='good'),bad=reports.filter(r=>r.expected==='bad');
const acceptedGood=good.filter(r=>r.verdict==='auto_pass').length/good.length;
const detectedBad=bad.filter(r=>r.verdict!=='auto_pass').length/bad.length;
const completeResponses=reports.every(r=>r.reviewer1&&r.reviewer2);
const passed=acceptedGood>=.7&&detectedBad>=.9&&(!live||completeResponses);
const report={live,mode:live?'Canlı sağlayıcı denetimi':'Yerel akış testi; sağlayıcı başarımı ölçümü değildir',finishedAt:new Date().toISOString(),fingerprint:await evaluationFingerprint(),acceptedGood,detectedBad,completeResponses,passed,reports};
await mkdir(new URL('../../eval-results/',import.meta.url),{recursive:true});
await writeFile(new URL(`../../eval-results/${live?'live':'offline'}.json`,import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({live,acceptedGood,detectedBad,passed,autoPublishUnlocked:live&&passed},null,2));
if(!passed)process.exitCode=1;
