import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config.js';
import { providerCatalog, createCompleter } from '../lib/llm.mjs';
import { decision, independent } from '../lib/verification.mjs';
import { autoPublishAllowed } from '../lib/evaluation-gate.mjs';

test('OpenRouter etkin değildir ve katalog isteği gönderilmez', async () => {
  let calls=0;
  assert.deepEqual(Object.keys(config.providers),['gemini','groq']);
  assert.deepEqual(config.roles.writer,['gemini']);
  await assert.rejects(providerCatalog('openrouter',{fetcher:async()=>{calls++;}}),/etkin değil/);
  assert.equal(calls,0);
});

test('Gemini kataloğundaki yalnızca fiyatı incelenmiş ücretsiz modeller seçilebilir', async () => {
  const previous=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='fixture-key';
  try{
    const approved=config.providers.gemini.approvedFreeModels[0];
    const catalog=await providerCatalog('gemini',{fetcher:async(url,options)=>{
      assert.ok(url.endsWith('/models?pageSize=1000'));
      assert.equal(options.headers['x-goog-api-key'],'fixture-key');
      assert.ok(!url.includes('fixture-key'));
      return Response.json({models:[{name:`models/${approved}`,supportedGenerationMethods:['generateContent']},{name:'models/gemini-unknown-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}]});
    }});
    assert.equal(catalog.find(m=>m.id===approved).free,true);
    assert.equal(catalog.filter(m=>m.free).length,1);
  }finally{previous===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=previous;}
});

test('Groq modelinin listelenmesi ücretsiz kullanım kanıtı sayılmaz', async () => {
  const previous=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY='fixture-key';
  try{
    const catalog=await providerCatalog('groq',{fetcher:async()=>Response.json({data:[{id:'llama-3.3-70b-versatile',active:true},{id:'qwen/qwen3.8-27b',active:true},{id:'openai/gpt-oss-120b',active:true}]})});
    assert.equal(catalog.some(m=>m.free),false);
  }finally{previous===undefined?delete process.env.GROQ_API_KEY:process.env.GROQ_API_KEY=previous;}
});

test('API kataloğu onaylarsa boş model ayarında Gemini otomatik seçilir', async () => {
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fixture-key';
  let requests=0;const approved=config.providers.gemini.approvedFreeModels[0];
  try{
    const complete=createCompleter({reserve:async provider=>{assert.equal(provider,'gemini');return true;},fetcher:async(url,options)=>{
      if(!options.method)return Response.json({models:[{name:`models/${approved}`,supportedGenerationMethods:['generateContent']}]});
      requests++;assert.ok(url.includes(approved));
      return Response.json({candidates:[{content:{parts:[{text:'[]'}]}}]});
    }});
    const result=await complete({role:'writer',system:'test',user:'[]'});
    assert.equal(result.provider,'gemini');assert.equal(result.model,approved);assert.equal(requests,1);
  }finally{previous===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=previous;}
});

test('Gemini veya Gemini/Groq incelemeleri kaynakla uyumlu olsa da otomatik yayını açmaz', async () => {
  const pass={provider:'gemini',family:'gemini',verdict:'pass',score:95,issues:[]};
  const writer={provider:'gemini',family:'gemini'};
  const article={title:'Deneme',summary:'Metin',body:'Metin',source_title:'Deneme',source_excerpt:'Metin',sensitivity:'normal'};
  for(const reviewer2 of [pass,{...pass,provider:'groq',family:'qwen'}]){
    assert.equal(independent(writer,pass,reviewer2),false);
    const result=decision({article,writer,reviewer1:pass,reviewer2,rules:[],corroborating:[],trustLevel:3});
    assert.equal(result.contentPass,true);assert.equal(result.eligible,false);assert.equal(result.verdict,'needs_review');
  }
  assert.equal(await autoPublishAllowed(),false);
});

test('Hesap erişimi ve faturalama hatası aynı sağlayıcının diğer modellerinde tekrarlanmaz', async () => {
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fixture-key';
  try{
    for(const [status,code] of [[401,'authentication'],[402,'billing'],[403,'forbidden']]){
      let requests=0,reservations=0;
      const complete=createCompleter({
        getModels:async()=>['gemini-first','gemini-second'],
        reserve:async()=>{reservations++;return true;},
        fetcher:async()=>{requests++;return new Response('',{status});},
        sleep:async()=>{throw new Error('Hesap hatası tekrar denenmemeli');}
      });
      await assert.rejects(complete({role:'writer',system:'test',user:'[]'}),error=>error.code===code);
      assert.equal(requests,1);assert.equal(reservations,1);
    }
  }finally{previous===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=previous;}
});

test('Tükenen bütçede model listesinde gereksiz rezervasyon yapılmaz',async()=>{
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fixture-key';let reservations=0;
  try{
    const complete=createCompleter({getModels:async()=>['gemini-first','gemini-second'],reserve:async()=>{reservations++;return false;},fetcher:async()=>{throw new Error('İstek gönderilmemeli');}});
    await assert.rejects(complete({role:'writer',system:'test',user:'[]'}),error=>error.code==='budget');
    assert.equal(reservations,1);
  }finally{previous===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=previous;}
});
