import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Postgres şeması, RLS, yayın kilitleri ve atomik sayaç',async t=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`);
    await db.exec(await readFile(new URL('../migrations/20261024222533_meridyen_initial.sql',import.meta.url),'utf8'));
    await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001','editor@example.invalid',now()),('00000000-0000-0000-0000-000000000002','reader@example.invalid',now());insert into public.admin_users values ('editor@example.invalid');insert into public.sources(id,name,feed_url,category,publisher_key,active,terms_confirmed,terms_url,trust_level) values ('10000000-0000-0000-0000-000000000001','A','https://example.invalid/a','Gündem','a',true,true,'https://example.invalid/terms',3),('10000000-0000-0000-0000-000000000002','A2','https://example.invalid/a2','Gündem','a',true,true,'https://example.invalid/terms',3),('10000000-0000-0000-0000-000000000003','B','https://example.invalid/b','Gündem','b',true,true,'https://example.invalid/terms',3);`);
    // Varsayılan değerler kullanılarak test kayıtları hazırlanır.
    const draft=(await db.query(`insert into public.articles(slug,title,summary,body,category,source_id,source_name,source_url) values('draft','Kütüphane programı','Okuma alanları ele alındı.','Yeni okuma alanlarının kullanımına ilişkin bir program açıklandı.','Gündem','10000000-0000-0000-0000-000000000001','A','https://example.invalid/draft') returning id`)).rows[0];
    await t.test('Anonim kullanıcı taslak ve iç alanları okuyamaz',async()=>{
      await db.exec('set role anon');assert.equal((await db.query('select id from public.articles')).rows.length,0);
      await assert.rejects(db.query('select verification from public.articles'));
      await assert.rejects(db.query('select feed_url from public.sources'));
      assert.equal((await db.query('select name from public.sources')).rows.length,3);
      await assert.rejects(db.query("update public.articles set status='published'"));await db.exec('reset role');
    });
    await t.test('Giriş yapmış yetkisiz kullanıcı panel verisini okuyamaz ve kendini yönetici yapamaz',async()=>{
      await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
      assert.equal((await db.query('select * from public.articles')).rows.length,0);assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed,false);
      await assert.rejects(db.query("insert into public.admin_users values ('reader@example.invalid')"));await db.exec('reset role');
    });
    await t.test('Yönetici inceleme onayı ve gerekçe olmadan yayımlayamaz',async()=>{
      await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
      assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed,true);
      await assert.rejects(db.query(`update public.articles set status='published' where id=$1`,[draft.id]));
      await db.query(`update public.articles set status='published',review_override=true,review_reason='Kaynak ve metin editör tarafından incelendi.' where id=$1`,[draft.id]);
      const a=(await db.query('select * from public.articles where id=$1',[draft.id])).rows[0];assert.equal(a.status,'published');assert.ok(a.reviewed_at);
      await db.query(`update public.articles set body='Okuma alanları konusunda yeni bir düzenleme paylaşıldı.' where id=$1`,[draft.id]);
      const changed=(await db.query('select * from public.articles where id=$1',[draft.id])).rows[0];assert.equal(changed.status,'draft');assert.equal(changed.verdict,'needs_review');assert.equal(changed.reviewed_at,null);
      await assert.rejects(db.query(`update public.articles set verdict='auto_pass' where id=$1`,[draft.id]));await db.exec('reset role');
    });
    await t.test('Hassas haberlerde aynı yayıncının iki akışı yeterli olmaz',async()=>{
      await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
      await db.query(`update public.articles set sensitivity='hassas',corroborating_sources=$1 where id=$2`,[JSON.stringify([{source_id:'10000000-0000-0000-0000-000000000002'}]),draft.id]);
      await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
      await assert.rejects(db.query(`update public.articles set status='published',review_override=true,review_reason='Metin ve kaynaklar incelendi.' where id=$1`,[draft.id]));
      await db.exec('reset role');await db.query(`update public.articles set corroborating_sources=$1 where id=$2`,[JSON.stringify([{source_id:'10000000-0000-0000-0000-000000000003'}]),draft.id]);
      await db.exec('set role authenticated');await db.query(`update public.articles set status='published',review_override=true,review_reason='İki bağımsız kaynak incelendi.' where id=$1`,[draft.id]);await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as n from public.social_queue')).rows[0].n,2);
    });
    await t.test('Servis anahtarı denetim kanıtı olmayan haberi yayımlayamaz',async()=>{
      await db.exec(`select set_config('request.jwt.claim.sub','',false);set role service_role;`);
      await assert.rejects(db.query(`update public.articles set status='draft';update public.articles set status='published'`));await db.exec('reset role');
    });
    await t.test('Bağımsız ve temiz denetim kanıtı yayına izin verir; aynı aile veya düşük skor engellenir',async()=>{
      await db.exec(`select set_config('request.jwt.claim.sub','',false);set role service_role;`);
      const article=(await db.query(`insert into public.articles(slug,title,summary,body,category,source_id,source_name,source_url,writer_provider,writer_family) values ('normal','Okuma alanları','Yeni program ele alındı.','Mahalle kütüphanesinde okuma alanları düzenlendi.','Gündem','10000000-0000-0000-0000-000000000001','A','https://example.invalid/normal','gemini','gemini') returning id`)).rows[0];
      const evidence={eligible:true,independent:true,reviewer1:{verdict:'pass',score:95,issues:[],provider:'groq',family:'llama'},reviewer2:{verdict:'pass',score:95,issues:[],provider:'openrouter',family:'qwen'},rules:[]};
      await db.query(`update public.articles set verdict='auto_pass',verification=$1 where id=$2`,[JSON.stringify(evidence),article.id]);
      await db.query(`update public.articles set status='published' where id=$1`,[article.id]);
      await db.query(`update public.articles set status='draft' where id=$1`,[article.id]);
      evidence.reviewer2.family='llama';await db.query(`update public.articles set verification=$1 where id=$2`,[JSON.stringify(evidence),article.id]);
      await assert.rejects(db.query(`update public.articles set status='published' where id=$1`,[article.id]));
      evidence.reviewer2.family='qwen';evidence.reviewer2.score=79;await db.query(`update public.articles set verification=$1 where id=$2`,[JSON.stringify(evidence),article.id]);
      await assert.rejects(db.query(`update public.articles set status='published' where id=$1`,[article.id]));
      await db.exec('reset role');
    });
    await t.test('Günlük sayaç 800 üzerinde rezervasyon vermez ve tarayıcıdan çağrılamaz',async()=>{
      await db.exec(`select set_config('request.jwt.claim.sub','',false);set role service_role;`);
      const reservations=[];for(let i=0;i<802;i++)reservations.push((await db.query("select public.reserve_llm_request('2026-10-24','fixture') as ok")).rows[0].ok);
      assert.equal(reservations.filter(Boolean).length,800);await db.exec('reset role;set role authenticated');
      await assert.rejects(db.query("select public.reserve_llm_request('2026-10-24','fixture')"));await db.exec('reset role');
    });
  }finally{await db.close();}
});
