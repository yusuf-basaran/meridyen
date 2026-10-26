import test from 'node:test';
import assert from 'node:assert/strict';
import { decision,ruleCheck,independent,crossSources,copyIssue } from '../lib/verification.mjs';
import { createCompleter,parseJSONResponse } from '../lib/llm.mjs';
import { validateWriter,validateReview,detectSensitivity } from '../lib/validation.mjs';
import { parseFeed,filterItem } from '../lib/rss.mjs';
import { slugify,uniqueSlug } from '../lib/slug.mjs';
import { config } from '../config.js';
import { goodCases,badCases } from '../scripts/eval/cases.mjs';
import { sanitizeError } from '../lib/utils.mjs';
import { isPrivateIP } from '../lib/network.mjs';
import { archiveMonths } from '../lib/archive.mjs';
import { articlePath } from '../lib/templates/pages.mjs';

const pass={verdict:'pass',score:95,issues:[],provider:'groq',family:'llama'};
const pass2={...pass,provider:'openrouter',family:'qwen'};
const fail={...pass,verdict:'fail',score:20,issues:[{text:'Çelişki',type:'celiski',severity:'yuksek'}]};
const base={article:goodCases[0].article,reviewer1:pass,reviewer2:pass2,rules:[],corroborating:[],trustLevel:3,writer:{provider:'gemini',family:'gemini'}};
test('Dosya sınırında eski aylar tek parça arşivlenir ve haber bağlantıları arşiv içeriğine gider',()=>{
  const articles=[{slug:'yeni',published_at:'2026-10-24'},{slug:'eski-a',published_at:'2026-09-01'},{slug:'eski-b',published_at:'2026-09-12'}];
  const archived=archiveMonths(articles,2);assert.equal(archived.length,1);assert.equal(archived[0][1].length,2);assert.equal(articlePath(articles[1]),'/arsiv/2026/09/#eski-a');assert.equal(articlePath(articles[0]),'/haber/2026/10/yeni/');
});
test('Eksik denetçi, düşük skor, kural sorunu ve düşük güvenli tek kaynak yayına uygun sayılmaz',()=>{
  assert.equal(decision(base).verdict,'auto_pass');
  for(const change of [{reviewer1:null},{reviewer2:null},{reviewer2:{...pass2,score:79}},{rules:[{type:'isim',severity:'dusuk'}]},{trustLevel:2}])assert.equal(decision({...base,...change}).verdict,'needs_review');
  assert.equal(decision({...base,trustLevel:2,corroborating:[{publisher_key:'other'}]}).verdict,'auto_pass');
});
test('Yazar ve denetçiler sağlayıcı ve aile açısından bağımsız olmalıdır',()=>{
  assert.equal(independent(base.writer,pass,pass2),true);
  assert.equal(decision({...base,writer:{provider:'groq',family:'llama'}}).verdict,'needs_review');
  assert.equal(decision({...base,reviewer2:{...pass2,family:'llama'}}).verdict,'needs_review');
});
test('Yüksek riskte bir yeniden yazım; ikinci başarısızlık reddedilir; hassas haberler insan incelemesinde kalır',()=>{
  assert.equal(decision({...base,reviewer1:fail,reviewer2:{...fail,provider:'openrouter'}}).rewrite,true);
  assert.equal(decision({...base,reviewer1:fail,retried:true}).verdict,'auto_reject');
  assert.equal(decision({...base,article:{...base.article,sensitivity:'hassas'}}).verdict,'needs_review');
  assert.equal(decision({...base,reviewer1:null,retried:true}).verdict,'needs_review');
});
test('Sayı, kişi adı, sahte alıntı ve tarih bozulmaları kurallarda görünür',()=>{
  for(const index of [0,1,2,5,8])assert.ok(ruleCheck(badCases[index].article).length>0,`bad-${index+1}`);
  assert.ok(copyIssue('bir iki üç dört beş altı yedi sekiz','bir iki üç dört beş altı yedi'));
  assert.equal(copyIssue('bir iki üç dört beş altı','bir iki üç dört beş altı'),null);
});
test('RSS ve Atom ayrıştırma, tekrar adresi ve ön eleme',()=>{
  const items=parseFeed('<rss><channel><item><title>Deneme</title><link>https://example.invalid/a</link><description><![CDATA[<p>Uzun haber metni</p>]]></description></item></channel></rss>');
  assert.equal(items[0].excerpt,'Uzun haber metni');
  assert.equal(parseFeed('<feed><entry><title>Atom</title><link href="https://example.invalid/a"/><summary>Metin</summary></entry></feed>')[0].title,'Atom');
  assert.throws(()=>parseFeed('feed not found'));assert.throws(()=>parseFeed('<!DOCTYPE rss><rss/>'));
  assert.equal(filterItem({title:'Sponsorlu kampanya',excerpt:'a'.repeat(200)}),false);
  assert.equal(filterItem({title:'Günlük haber',excerpt:'kısa'}),false);
});
test('Aynı yayıncının farklı RSS adresleri bağımsız kaynak sayılmaz',()=>{
  const a={...base.article,id:'a',source_id:'a',source_title:'kent ulaşım planı toplantıda ele alındı'};
  const candidates=[{...a,id:'b',source_id:'b'},{...a,id:'c',source_id:'c'},{...a,id:'d',source_id:'d',source_published_at:'2026-10-22T00:00:00Z'}];
  const sources=[{id:'a',publisher_key:'bbc',active:true},{id:'b',publisher_key:'bbc',active:true},{id:'c',publisher_key:'dw',active:true},{id:'d',publisher_key:'npr',active:true}];
  assert.deepEqual(crossSources(a,candidates,sources).map(s=>s.source_id),['c']);
});
test('Türkçe slug, uzunluk ve çakışma güvenliği',async()=>{
  assert.equal(slugify('İstanbul: Çığ, Göl, Şehir ve Ülke'),'istanbul-cig-gol-sehir-ve-ulke');
  const slug=await uniqueSlug('ç'.repeat(120),async value=>!value.includes('-'));assert.equal(slug.length,80);assert.match(slug,/-[a-f0-9]{4}$/);
});
test('Yanıt şemaları ve ekonomik/tıbbi hassasiyet',()=>{
  assert.equal(validateReview({...pass,issues:[{type:'bilinmeyen'}]}),false);
  assert.equal(validateWriter({skip:false,skip_reason:'',title:'Deneme'}),false);
  assert.deepEqual(parseJSONResponse('```json\n[{"ok":true}]\n```'),[{ok:true}]);
  assert.equal(detectSensitivity('Tedavi yöntemi duyuruldu'),'hassas');
  assert.equal(detectSensitivity('Gelir 10 milyon lira oldu'),'hassas');
  assert.equal(detectSensitivity('Bölüm çalışanları ulaşım programını tanıttı.'),'normal');
});
test('SSRF ve hata maskeleme',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','fd00::1','::ffff:127.0.0.1'])assert.equal(isPrivateIP(ip),true);
  process.env.TEST_SECRET='private-test-value';assert.ok(!sanitizeError(new Error('key private-test-value')).includes('private-test-value'));delete process.env.TEST_SECRET;
});
test('Başarısız Gemini istekleri bütçeye sayılır; aynı sağlayıcıda ücretsiz yedeğe geçilir',async()=>{
  const previous=config.providers.gemini.models;
  const oldGemini=process.env.GEMINI_API_KEY;
  config.providers.gemini.models=['gemini-test','gemini-fallback-test'];process.env.GEMINI_API_KEY='fixture';
  const reservations=[];let calls=0;
  try{
    const complete=createCompleter({getModels:async provider=>config.providers[provider].models,reserve:async provider=>{reservations.push(provider);return true;},sleep:async()=>{},fetcher:async url=>{
      assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));calls++;
      return calls<=3?new Response('',{status:429}):Response.json({candidates:[{content:{parts:[{text:'[{"ok":true}]'}]}}]});
    }});
    const response=await complete({role:'writer',system:'test',user:'[]'});assert.equal(response.provider,'gemini');assert.equal(response.model,'gemini-fallback-test');assert.deepEqual(reservations,['gemini','gemini','gemini','gemini']);
    const noBudget=createCompleter({getModels:async provider=>config.providers[provider].models,reserve:async()=>false,fetcher:async()=>{throw new Error('Bütçe olmadan çağrı yapılmamalı');}});
    await assert.rejects(noBudget({role:'writer',system:'test',user:'[]'}));
  }finally{config.providers.gemini.models=previous;oldGemini===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldGemini;}
});
