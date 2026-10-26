import { config } from '../config.js';
import { normalize, words } from './utils.mjs';
import { REVIEWER1_SYSTEM, REVIEWER2_SYSTEM } from './prompts.mjs';
import { validateReview, detectSensitivity } from './validation.mjs';

const genericStarts = new Set(['Bu','Buna','Bunun','Bir','Yeni','İlgili','Açıklamada','Açıklamaya','Yapılan','Çalışmada','Çalışmalar','Çalışmanın','Ayrıca','Böylece','Ancak','Öte','Her','Söz','Konuya','Toplantıda','Programda','Kaynakta','Kaynağa','Haberde','Başvurular','Kullanım','Katılımcılardan','Masa']);
const numbers = text => [...String(text).matchAll(/\d+(?:[.,:/-]\d+)*/g)].map(m=>m[0]);
export function copyIssue(source, output) {
  const sourceWords=words(normalize(source));const outputWords=words(normalize(output));
  const grams=new Set();for(let i=0;i<=sourceWords.length-7;i++)grams.add(sourceWords.slice(i,i+7).join(' '));
  for(let i=0;i<=outputWords.length-7;i++){const gram=outputWords.slice(i,i+7).join(' ');if(grams.has(gram))return {text:gram,type:'kopya',severity:'orta'};}
  return null;
}
export function ruleCheck(article) {
  const source=`${article.source_title || ''} ${article.source_excerpt || ''}`;
  const output=`${article.title}\n${article.summary}\n${article.body || ''}`;
  const issues=[];const add=(text,type,severity='orta')=>issues.push({text,type,severity});
  const sourceNumbers=new Set(numbers(source));
  for(const number of new Set(numbers(output)))if(!sourceNumbers.has(number))add(`Kaynakta bulunmayan sayı veya tarih: ${number}`,'sayi_tarih','yuksek');
  for(const number of new Set(numbers(article.title)))if(!numbers(article.body).includes(number))add(`Başlıktaki sayı gövdede bulunmuyor: ${number}`,'sayi_tarih');
  const units={million:'milyon',billion:'milyar',thousand:'bin',percent:'yüzde',dollars:'dolar',dollar:'dolar',euros:'euro',liras:'lira',kilometers:'kilometre',kilometres:'kilometre'};
  const unitTokens=text=>[...String(text).toLocaleLowerCase('tr-TR').matchAll(/(\d+(?:[.,]\d+)*)\s*(milyon|milyar|bin\b|million|billion|thousand|yüzde|percent|dollars?\b|dolar|euro(?:s)?\b|lira(?:s)?\b|kilometers?|kilometres?|kilometre|kg\b|km\b|%)(?=$|[^\p{L}])/gu)].map(m=>`${m[1]} ${units[m[2]]||m[2]}`);
  const sourceUnits=new Set(unitTokens(source+' '));
  for(const unit of new Set(unitTokens(output+' ')))if(!sourceUnits.has(unit))add(`Kaynakta aynı birimle bulunmayan değer: ${unit}`,'sayi_tarih','yuksek');
  for(const quote of output.matchAll(/[“"]([^“”"\n]{3,})[”"]/g))if(!normalize(source).includes(normalize(quote[1])))add(`Kaynakta bulunmayan alıntı: ${quote[1]}`,'uydurma','yuksek');
  const sourceNormalized=` ${normalize(source)} `;
  for(const name of new Set(output.match(/(?<![\p{L}])[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:['’][a-zçğıöşü]+)?|(?<![\p{L}])[A-ZÇĞİÖŞÜ]{2,}(?![\p{L}])/gu)||[])){
    const root=name.split(/['’]/)[0];
    if(!genericStarts.has(root)&&!sourceNormalized.includes(` ${normalize(root)} `))add(`Kaynakta bulunmayan büyük harfli sözcük: ${root}`,'isim','dusuk');
  }
  if(article.title.length>90)add('Başlık 90 karakteri aşıyor','uzunluk');
  if(/kesinleşti|şok|flaş|inanılmaz|kaçırmayın/iu.test(output))add('Yasaklı veya kesin hüküm bildiren ifade','abarti');
  if(/[!]|\p{Extended_Pictographic}/u.test(output))add('Ünlem veya görsel simge içeriyor','uslup');
  const copied=copyIssue(source,output);if(copied)issues.push(copied);
  return issues;
}
const stopwords=new Set(['bir','ve','ile','için','bu','da','de','the','and','for','in','on','to','of','a','an','ile','yeni','son','olan','olarak','daha','haber']);
export function keywords(title){return new Set(normalize(title).split(' ').filter(w=>w.length>=3&&!stopwords.has(w)));}
export function crossSources(article,candidates,sources) {
  const original=sources.find(s=>s.id===article.source_id);if(!original)return [];
  const a=keywords(article.source_title||article.title);if(a.size<config.crossSourceMinWords)return [];
  const time=Date.parse(article.source_published_at||article.created_at);if(!Number.isFinite(time))return [];
  const matched=new Map();
  for(const other of candidates){
    if(other.id===article.id||other.source_id===article.source_id)continue;
    const source=sources.find(s=>s.id===other.source_id);
    if(!source||!source.active||source.publisher_key===original.publisher_key||matched.has(source.publisher_key))continue;
    const age=Math.abs(time-Date.parse(other.source_published_at||other.created_at));if(!Number.isFinite(age)||age>config.crossSourceHours*3600000)continue;
    const b=keywords(other.source_title||other.title);if(b.size<config.crossSourceMinWords)continue;
    const shared=[...a].filter(w=>b.has(w)).length;
    const score=shared/Math.max(a.size,b.size);
    if(shared>=config.crossSourceMinWords&&score>=config.crossSourceThreshold)matched.set(source.publisher_key,{source_id:source.id,publisher_key:source.publisher_key,name:source.name,url:other.source_url,score});
  }
  return [...matched.values()];
}
export function independent(writer,reviewer1,reviewer2) {
  const parties=[writer,reviewer1,reviewer2];
  return parties.every(p=>p?.provider&&p?.family)&&new Set(parties.map(p=>p.provider)).size===3&&new Set(parties.map(p=>p.family)).size===3;
}
export function decision({article,reviewer1,reviewer2,rules,corroborating,trustLevel,writer,retried=false}) {
  const missing=!reviewer1||!reviewer2;
  const isIndependent=independent(writer,reviewer1,reviewer2);
  const risk=article.sensitivity==='hassas'||detectSensitivity(`${article.source_title} ${article.source_excerpt} ${article.title} ${article.summary} ${article.body}`)==='hassas';
  const severe=(!missing&&reviewer1.verdict==='fail'&&reviewer2.verdict==='fail')||[...(reviewer1?.issues||[]),...(reviewer2?.issues||[]),...rules].some(i=>i.severity==='yuksek'&&['celiski','uydurma','sayi_tarih','isim'].includes(i.type));
  const pass=!missing&&reviewer1.verdict==='pass'&&reviewer2.verdict==='pass'&&reviewer1.score>=config.scoreThreshold&&reviewer2.score>=config.scoreThreshold&&rules.length===0;
  const sourceCondition=corroborating.length>=1||trustLevel===3;
  const eligible=pass&&isIndependent&&sourceCondition&&!risk;
  let verdict=eligible?'auto_pass':'needs_review';
  if(retried&&!missing&&!pass)verdict='auto_reject';
  if(risk)verdict='needs_review';
  return {verdict,status:verdict==='auto_reject'?'rejected':'draft',eligible,contentPass:pass,independent:isIndependent,rewrite:severe&&!retried&&!risk,sensitivity:risk?'hassas':'normal',confidence:missing?null:Math.min(reviewer1.score,reviewer2.score),missing};
}
export async function reviewBatch(articles,complete) {
  const input=JSON.stringify(articles.map(a=>({source:{title:a.source_title,excerpt:a.source_excerpt},article:{title:a.title,summary:a.summary,body:a.body}})));
  const jobs=[['reviewer1',REVIEWER1_SYSTEM],['reviewer2',REVIEWER2_SYSTEM]];
  const responses=await Promise.allSettled(jobs.map(([role,system])=>complete({role,system,user:input,schema:{type:'array',items:{verdict:'pass|fail',score:'0-100',issues:'array'}}})));
  return articles.map((article,i)=>{
    const parsed=responses.map(response=>{
      if(response.status!=='fulfilled')return null;
      const result=response.value;
      if(!Array.isArray(result.data)||result.data.length!==articles.length||!validateReview(result.data[i]))return null;
      return {...result.data[i],provider:result.provider,model:result.model,family:result.family};
    });
    return {article,reviewer1:parsed[0],reviewer2:parsed[1]};
  });
}
