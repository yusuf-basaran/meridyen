import { config } from '../config.js';
import { database,checked,withRun } from '../lib/supabase.mjs';
import { articlePath } from '../lib/templates/pages.mjs';
import { safeURL,assertEnv,logError } from '../lib/utils.mjs';

class SendError extends Error{constructor(message,{uncertain=false,retryable=false}={}){super(message);this.uncertain=uncertain;this.retryable=retryable;}}
async function requestJSON(url,payload,headers={}){
  let response;
  try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});}catch{throw new SendError('Gönderim sonucu alınamadı',{uncertain:true});}
  if(!response.ok)throw new SendError(`Sosyal kanal HTTP ${response.status}`,{uncertain:response.status>=500,retryable:response.status===429});
  try{return await response.json();}catch{throw new SendError('Gönderim yanıtı çözülemedi',{uncertain:true});}
}
const channels={
  telegram:{enabled:()=>Boolean(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),send:async({title,url})=>{
    const result=await requestJSON(`${config.endpoints.telegram}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{chat_id:process.env.TELEGRAM_CHAT_ID,text:`${title}\n${url}`,link_preview_options:{is_disabled:true}});
    if(!result.ok)throw new SendError('Telegram gönderimi kabul etmedi');
  }},
  bluesky:{enabled:()=>Boolean(process.env.BLUESKY_HANDLE&&process.env.BLUESKY_APP_PASSWORD),send:async({title,url},queue)=>{
    const session=await requestJSON(`${config.endpoints.bluesky}/com.atproto.server.createSession`,{identifier:process.env.BLUESKY_HANDLE,password:process.env.BLUESKY_APP_PASSWORD});
    const text=`${title}\n${url}`;const start=Buffer.byteLength(title+'\n');
    const response=await requestJSON(`${config.endpoints.bluesky}/com.atproto.repo.putRecord`,{repo:session.did,collection:'app.bsky.feed.post',rkey:`meridyen${queue.id.replaceAll('-','')}`,record:{$type:'app.bsky.feed.post',text,createdAt:new Date().toISOString(),langs:['tr'],facets:[{index:{byteStart:start,byteEnd:start+Buffer.byteLength(url)},features:[{$type:'app.bsky.richtext.facet#link',uri:url}]}]}},{Authorization:`Bearer ${session.accessJwt}`});
    if(!response.uri)throw new SendError('Bluesky gönderim kaydı alınamadı',{uncertain:true});
  }}
};
async function social(){
  assertEnv(['SITE_URL']);if(!safeURL(process.env.SITE_URL)||!process.env.SITE_URL.startsWith('https://'))throw new Error('SITE_URL bir HTTPS adresi olmalıdır');
  const db=database();
  // Tamamlanmamış gönderimlerde aynı iletiyi yeniden göndermek yerine inceleme gerekir.
  checked(await db.from('social_queue').update({status:'uncertain'}).eq('status','sending').lt('attempted_at',new Date(Date.now()-30*60000).toISOString()));
  const queue=checked(await db.from('social_queue').select('*,articles(*)').eq('status','pending').lt('attempts',3).order('attempted_at',{ascending:true,nullsFirst:true}).limit(30));
  let sent=0,skipped=0,errors=0;
  for(const item of queue){
    const channel=channels[item.channel],article=item.articles;
    if(!channel?.enabled()||!article||article.status!=='published'||(article.sensitivity==='hassas'&&!article.reviewed_at)){skipped++;continue;}
    const url=new URL(articlePath(article),process.env.SITE_URL).href;
    try{
      const published=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!published.ok){skipped++;continue;}
    }catch{skipped++;continue;}
    if(!checked(await db.rpc('claim_social',{p_id:item.id})))continue;
    try{
      await channel.send({title:article.title,url},item);
      checked(await db.from('social_queue').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',item.id));sent++;
    }catch(error){
      const status=error.uncertain?'uncertain':error.retryable&&item.attempts+1<3?'pending':'failed';
      checked(await db.from('social_queue').update({status}).eq('id',item.id));errors++;
      // Dış servis URL'lerinde kanal anahtarı bulunabildiği için ham hatayı kaydetme.
      console.error(JSON.stringify({step:'social',channel:item.channel,status}));
    }
  }
  return {sent,skipped,errors};
}
try{console.log(JSON.stringify(await withRun('social',social)));}catch(error){logError('social',error);process.exitCode=1;}
