import test from 'node:test';
import assert from 'node:assert/strict';
import { configureContact,setupReport,SETUP_SECRETS } from '../lib/setup.mjs';
import { ensurePagesProject } from '../lib/pages-project.mjs';

test('Eksik anahtarda servis çağrılmaz; kurulum raporu anahtar değerlerini içermez',async()=>{
  let calls=0;const checkDatabase=async()=>{calls++;return true;};
  const empty=await setupReport({env:{},contact:{},checkDatabase});assert.equal(calls,0);assert.equal(empty.ready,false);assert.equal(empty.schema,'not_checked');
  const env=Object.fromEntries(SETUP_SECRETS.map(name=>[name,`private-${name}`]));
  const ready=await setupReport({env,contact:{owner:'Yayın sahibi',email:'editor@example.invalid',address:'İletişim adresi'},checkDatabase});assert.equal(ready.ready,true);assert.equal(calls,1);assert.ok(!JSON.stringify(ready).includes('private-'));
  const missingSchema=await setupReport({env,contact:{owner:'Yayın sahibi',email:'editor@example.invalid',address:'İletişim adresi'},checkDatabase:async()=>false});assert.equal(missingSchema.ready,false);
});
test('Künye formu tırnak, satır sonu ve kod benzeri girdiyi metin olarak kaydeder',()=>{
  const source="export const config = {\n  contact: { owner: '', email: '', address: '' },\n  dailyLimit: 800\n};\n";
  const contact={owner:"O'Brien ${process.env.TEST}",email:'editor@example.invalid',address:'Adres\nİkinci satır'};
  const result=configureContact(source,contact);const line=result.split('\n').find(line=>line.trim().startsWith('contact:'));
  assert.deepEqual(JSON.parse(line.trim().slice('contact:'.length).replace(/,$/,'')),contact);assert.ok(result.includes('dailyLimit: 800'));assert.equal(configureContact(source,{}),source);
  assert.throws(()=>configureContact(source,{owner:'Eksik'}));
});
const base={accountId:'a'.repeat(32),token:'private-token',projectName:'meridyen',repository:'owner/meridyen'};
const project={production_branch:'main',subdomain:'meridyen.pages.dev'};
test('Mevcut Cloudflare projesi korunur; bulunmayan proje main dalıyla bir kez oluşturulur',async()=>{
  const existingCalls=[];const existing=await ensurePagesProject({...base,fetcher:async(url,options)=>{existingCalls.push(options);return Response.json({success:true,result:project});}});
  assert.equal(existing.created,false);assert.equal(existingCalls.length,1);assert.equal(existing.siteURL,'https://meridyen.pages.dev');
  const calls=[];const created=await ensurePagesProject({...base,fetcher:async(url,options)=>{calls.push(options);return calls.length===1?new Response('',{status:404}):Response.json({success:true,result:project});}});
  assert.equal(created.created,true);assert.deepEqual(JSON.parse(calls[1].body),{name:'meridyen',production_branch:'main'});assert.equal(calls.length,2);
});
test('Cloudflare yetki hatasında proje oluşturulmaz; farklı depo ve geçersiz adres reddedilir',async()=>{
  let calls=0;await assert.rejects(ensurePagesProject({...base,fetcher:async()=>{calls++;return new Response('',{status:403});}}));assert.equal(calls,1);
  await assert.rejects(ensurePagesProject({...base,fetcher:async()=>Response.json({success:true,result:{...project,source:{config:{owner:'other',repo_name:'other'}}}})}));
  await assert.rejects(ensurePagesProject({...base,fetcher:async()=>Response.json({success:true,result:{...project,subdomain:'https://evil.invalid/'}})}));
  await assert.rejects(ensurePagesProject({...base,projectName:'../bad',fetcher:async()=>{throw new Error('Çağrılmamalı');}}));
});
