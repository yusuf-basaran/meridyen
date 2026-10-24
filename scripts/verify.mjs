import { config, AUTO_PUBLISH } from '../config.js';
import { database, checked, withRun } from '../lib/supabase.mjs';
import { complete } from '../lib/llm.mjs';
import { WRITER_SYSTEM } from '../lib/prompts.mjs';
import { validateWriter } from '../lib/validation.mjs';
import { ruleCheck, crossSources, decision, reviewBatch } from '../lib/verification.mjs';
import { autoPublishAllowed } from '../lib/evaluation-gate.mjs';
import { chunk, logError } from '../lib/utils.mjs';

async function verify(){
  const db=database();
  const sources=checked(await db.from('sources').select('*'));
  const candidates=checked(await db.from('articles').select('*').gte('created_at',new Date(Date.now()-24*3600000).toISOString()).order('created_at',{ascending:false}).limit(2000));
  const drafts=checked(await db.from('articles').select('*').eq('status','draft').or('verdict.eq.pending,and(verdict.eq.needs_review,verification->>retry.eq.true)').order('created_at').limit(100));
  const mayPublish=AUTO_PUBLISH&&await autoPublishAllowed();
  if(AUTO_PUBLISH&&!mayPublish)console.warn('Yayın kilidi: güncel ve başarılı canlı değerlendirme raporu gerekli.');
  const totals={processed:0,auto_pass:0,needs_review:0,auto_reject:0,published:0};
  async function processResult(initial){
    let {article,reviewer1,reviewer2}=initial;
    const corroborating=crossSources(article,candidates,sources);
    let rules=ruleCheck(article);
    let writer={provider:article.writer_provider,model:article.writer_model,family:article.writer_family};
    const trustLevel=sources.find(s=>s.id===article.source_id)?.trust_level||1;
    let outcome=decision({article,reviewer1,reviewer2,rules,corroborating,trustLevel,writer,retried:article.rewrite_count>=1});
    const logs=[];
    const collectLogs=()=>{
      for(const [role,review] of [['denetci1',reviewer1],['denetci2',reviewer2]])logs.push({article_id:article.id,role,provider:review?.provider||null,model:review?.model||null,verdict:review?.verdict||'unavailable',issues:review?.issues||[{type:'yanit_yok',severity:'orta',text:'Denetçi yanıtı alınamadı veya geçersiz.'}]});
      logs.push({article_id:article.id,role:'kural',provider:'local',verdict:rules.length?'fail':'pass',issues:rules});
    };
    collectLogs();
    if(outcome.rewrite&&article.rewrite_count<1){
      checked(await db.from('articles').update({rewrite_count:1}).eq('id',article.id));
      try{
        const response=await complete({role:'writer',system:WRITER_SYSTEM,user:JSON.stringify([{title:article.source_title,excerpt:article.source_excerpt,previous:{title:article.title,summary:article.summary,body:article.body},feedback:[...(reviewer1?.issues||[]),...(reviewer2?.issues||[]),...rules]}])});
        const output=response.data?.[0];
        if(!Array.isArray(response.data)||response.data.length!==1||!validateWriter(output)||output.skip)throw new Error('Yeniden yazım yanıtı geçersiz');
        writer={provider:response.provider,model:response.model,family:response.family};
        article={...article,title:output.title,summary:output.summary,body:output.body,category:output.category,sensitivity:article.sensitivity==='hassas'?'hassas':output.sensitivity,rewrite_count:1,writer_provider:writer.provider,writer_model:writer.model,writer_family:writer.family};
        logs.push({article_id:article.id,role:'yazar_yeniden',provider:writer.provider,model:writer.model,verdict:'rewritten',issues:[]});
        const retry=(await reviewBatch([article],complete))[0];reviewer1=retry.reviewer1;reviewer2=retry.reviewer2;rules=ruleCheck(article);
        outcome=decision({article,reviewer1,reviewer2,rules,corroborating,trustLevel,writer,retried:true});collectLogs();
      }catch(error){
        logError('rewrite',error);outcome={...outcome,verdict:'needs_review',status:'draft',eligible:false,missing:true};
        logs.push({article_id:article.id,role:'yazar_yeniden',verdict:'unavailable',issues:[{type:'yanit_yok',severity:'orta',text:'Yeniden yazım tamamlanamadı; editoryal inceleme gerekli.'}]});
      }
    }
    logs.push({article_id:article.id,role:'capraz',provider:'local',verdict:corroborating.length?'match':'single_source',issues:corroborating});
    const evidence={reviewer1,reviewer2,rules,independent:outcome.independent,eligible:outcome.eligible,retry:outcome.missing,checked_at:new Date().toISOString()};
    const status=mayPublish&&outcome.verdict==='auto_pass'&&outcome.sensitivity==='normal'?'published':outcome.status;
    checked(await db.from('verification_log').insert(logs));
    checked(await db.from('articles').update({title:article.title,summary:article.summary,body:article.body,category:article.category,sensitivity:outcome.sensitivity,verdict:outcome.verdict,status,confidence:outcome.confidence,verification:evidence,corroborating_sources:corroborating,writer_provider:writer.provider,writer_model:writer.model,writer_family:writer.family}).eq('id',article.id));
    totals.processed++;totals[outcome.verdict]++;if(status==='published')totals.published++;
  }
  for(const batch of chunk(drafts,config.batchSize))for(const reviewed of await reviewBatch(batch,complete))await processResult(reviewed);
  return totals;
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){try{console.log(JSON.stringify(await withRun('verify',verify)));}catch(error){logError('verify',error);process.exitCode=1;}}
export { verify, ruleCheck, crossSources, decision, reviewBatch };
