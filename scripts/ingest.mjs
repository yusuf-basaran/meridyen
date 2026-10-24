import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { database, checked, withRun } from '../lib/supabase.mjs';
import { fetchFeed, filterItem } from '../lib/rss.mjs';
import { hash, normalize, chunk, logError } from '../lib/utils.mjs';
import { uniqueSlug } from '../lib/slug.mjs';
import { complete } from '../lib/llm.mjs';
import { WRITER_SYSTEM } from '../lib/prompts.mjs';
import { validateWriter, detectSensitivity } from '../lib/validation.mjs';

async function ingest(){
  const db=database();
  const sources=checked(await db.from('sources').select('*').eq('active',true).eq('terms_confirmed',true).order('last_fetched_at',{ascending:true,nullsFirst:true}));
  const pending=checked(await db.from('articles').select('*').eq('status','pending').order('created_at').limit(config.maxNewItems));
  let added=0,skipped=0,errors=0;
  const feeds=[];
  for(const source of sources){
    try{
      const items=await fetchFeed(source.feed_url);
      feeds.push({source,items});
    }catch(error){errors++;logError(`rss:${source.name}`,error);}
    finally{checked(await db.from('sources').update({last_fetched_at:new Date().toISOString()}).eq('id',source.id));}
  }
  const candidates=[];
  const longest=Math.max(0,...feeds.map(f=>f.items.length));
  for(let i=0;i<longest;i++)for(const feed of feeds)if(feed.items[i])candidates.push({source:feed.source,item:feed.items[i]});
  for(const {source,item} of candidates){
        if(pending.length>=config.maxNewItems)break;
        if(!filterItem(item)){skipped++;continue;}
        const contentHash=hash(`${normalize(item.title)}|${normalize(source.name)}`);
        const [byURL,byHash]=await Promise.all([db.from('articles').select('id').eq('source_url',item.url).limit(1),db.from('articles').select('id').eq('content_hash',contentHash).limit(1)]);
        if(checked(byURL).length||checked(byHash).length)continue;
        const id=randomUUID();const slug=await uniqueSlug(item.title,async value=>checked(await db.from('articles').select('id').eq('slug',value)).length>0);
        const record={id,slug,title:item.title,summary:item.excerpt,body:null,category:source.category,source_id:source.id,source_name:source.name,source_url:item.url,source_title:item.title,source_excerpt:item.excerpt,source_published_at:item.publishedAt,status:'pending',verdict:'pending',content_hash:contentHash,sensitivity:detectSensitivity(`${item.title} ${item.excerpt}`)};
        const response=await db.from('articles').insert(record).select().single();
        if(response.error?.code==='23505')continue;
        pending.push(checked(response));added++;
  }
  for(const batch of chunk(pending,config.batchSize)){
    try{
      const response=await complete({role:'writer',system:WRITER_SYSTEM,user:JSON.stringify(batch.map(a=>({title:a.source_title,excerpt:a.source_excerpt,category:a.category}))),schema:{type:'array',items:'haber'}});
      if(!Array.isArray(response.data)||response.data.length!==batch.length)throw new Error('Yanıt dizisi öğe sayısıyla eşleşmiyor');
      for(let i=0;i<batch.length;i++){
        const output=response.data[i],article=batch[i];
        if(!validateWriter(output)){checked(await db.from('articles').update({status:'rejected',verdict:'auto_reject',review_reason:'Geçersiz yazım yanıtı'}).eq('id',article.id));errors++;continue;}
        if(output.skip){checked(await db.from('articles').update({status:'rejected',verdict:'auto_reject',review_reason:String(output.skip_reason).slice(0,500)}).eq('id',article.id));skipped++;continue;}
        const slug=await uniqueSlug(output.title,async value=>checked(await db.from('articles').select('id').eq('slug',value).neq('id',article.id)).length>0);
        checked(await db.from('articles').update({slug,title:output.title,summary:output.summary,body:output.body,category:output.category,sensitivity:article.sensitivity==='hassas'||output.sensitivity==='hassas'?'hassas':detectSensitivity(`${output.title} ${output.summary} ${output.body}`),status:'draft',verdict:'pending',writer_provider:response.provider,writer_model:response.model,writer_family:response.family}).eq('id',article.id));
      }
    }catch(error){errors++;logError('writer',error);}
  }
  // Kaynak bulunmasa bile bağlantı ve son çalışma kaydı korunur.
  checked(await db.from('sources').select('id').limit(1));
  return {added,skipped,errors,pending:pending.length};
}
try{console.log(JSON.stringify(await withRun('ingest',ingest)));}catch(error){logError('ingest',error);process.exitCode=1;}
