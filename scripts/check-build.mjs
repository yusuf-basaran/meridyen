import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile,stat,mkdir,writeFile,access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { demoArticles } from '../fixtures/articles.mjs';
import { articlePath } from '../lib/templates/pages.mjs';

const publishedAt=new Date().toISOString();
let records=Array.from({length:42},(_,i)=>({...structuredClone(demoArticles[i%demoArticles.length]),id:`test-${i}`,slug:`yerel-test-${i}`,title:`Yerel test haberi ${i}`,category:'Gündem',source_name:'Kurgu kaynak (test)',source_url:`https://example.invalid/source/${i}`,published_at:publishedAt,updated_at:publishedAt,status:'published',featured:i===0}));
records.push({...records[0],id:'secret-draft',slug:'gizli-taslak',title:'Yayımlanmayan taslak metni',status:'draft'});
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/rest/v1/articles'||url.searchParams.get('status')!=='eq.published'){res.writeHead(400).end();return;}
  const rows=records.filter(r=>r.status==='published');
  res.writeHead(200,{'Content-Type':'application/json','Content-Range':`0-${rows.length-1}/${rows.length}`}).end(JSON.stringify(rows));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const out='artifacts/production-fixture';
async function build({launch=false}={}){await new Promise((resolve,reject)=>{const process=spawn('node',['scripts/build.mjs','--out',out,...(launch?['--launch']:[])],{env:{...globalThis.process.env,SUPABASE_URL:launch?'https://unreachable.invalid':`http://127.0.0.1:${server.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'fixture-not-a-secret',SUPABASE_ANON_KEY:'sb_publishable_fixture',SITE_URL:'https://meridyen.test',MERIDYEN_BUILD_TEST:'1'},stdio:['ignore','pipe','pipe']});let output='';process.stdout.on('data',chunk=>output+=chunk);process.stderr.on('data',chunk=>output+=chunk);process.on('exit',code=>code===0?resolve():reject(new Error(output)));});}
const report={};
try{
  await build();
  const home=await readFile(`${out}/index.html`,'utf8');assert.ok(!home.includes('Yayımlanmayan taslak metni'));assert.ok(home.includes('index, follow'));assert.ok(home.includes('https://meridyen.test/'));assert.ok(home.includes('application/ld+json'));
  assert.ok((await readFile(`${out}/kategori/gundem/sayfa/3/index.html`,'utf8')).includes('Yerel test haberi'));
  const firstPath=`${out}${articlePath(records[0])}index.html`;const oldTime=(await stat(firstPath)).mtimeMs;
  await build();assert.equal((await stat(firstPath)).mtimeMs,oldTime);assert.equal(JSON.parse(await readFile(`${out}/test-fixture.json`,'utf8')).rebuilt,0);
  records[0].body='Yerel test metni değiştirildi. Yeni içerik statik sayfaya yazılmalıdır.';records[0].updated_at=new Date().toISOString();
  await build();assert.ok((await readFile(firstPath,'utf8')).includes('Yerel test metni değiştirildi'));assert.equal(JSON.parse(await readFile(`${out}/test-fixture.json`,'utf8')).rebuilt,1);
  const removedPath=`${out}${articlePath(records[41])}index.html`;records[41].status='rejected';await build();await assert.rejects(access(removedPath));
  const index=JSON.parse(await readFile(`${out}/search-index.json`,'utf8'));assert.equal(index.length,41);assert.ok(!index.some(a=>a.id==='secret-draft'));
  assert.ok((await readFile(`${out}/news-sitemap.xml`,'utf8')).includes('<news:news>'));assert.ok((await readFile(`${out}/rss.xml`,'utf8')).includes('<item>'));
  const admin=await readFile(`${out}/yonetim/index.html`,'utf8');assert.ok(admin.includes('noindex, nofollow'));
  assert.ok(!(await readFile(`${out}/public-config.json`,'utf8')).includes('fixture-not-a-secret'));
  await build({launch:true});
  const launchHome=await readFile(`${out}/index.html`,'utf8');
  assert.ok(launchHome.includes('Yayına hazırlanıyoruz'));
  assert.ok(launchHome.includes('noindex, nofollow'));
  assert.ok(!launchHome.includes('Yerel test haberi'));
  assert.ok(!launchHome.includes('NewsArticle'));
  await assert.rejects(access(firstPath));
  assert.deepEqual(JSON.parse(await readFile(`${out}/search-index.json`,'utf8')),[]);
  assert.equal(JSON.parse(await readFile(`${out}/public-config.json`,'utf8')).supabaseKey,'');
  assert.equal(JSON.parse(await readFile(`${out}/public-config.json`,'utf8')).supabaseURL,'');
  assert.ok((await readFile(`${out}/kategori/gundem/index.html`,'utf8')).includes('noindex, nofollow'));
  assert.equal(await readFile(`${out}/robots.txt`,'utf8'),'User-agent: *\nDisallow: /\n');
  assert.ok(!(await readFile(`${out}/sitemap.xml`,'utf8')).includes('<url>'));
  assert.ok(!(await readFile(`${out}/rss.xml`,'utf8')).includes('<item>'));
  Object.assign(report,{passed:true,publishedOnly:true,pagination:true,incrementalUnchanged:0,incrementalBodyChange:1,unpublishCleanup:true,xml:true,clientSecretExcluded:true,launchWithoutDatabase:true,launchClearsOldArticles:true,launchNoindex:true,fixtureOnly:true,finishedAt:new Date().toISOString()});
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/build-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
