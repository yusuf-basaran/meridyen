import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const findings={layouts:[],accessibility:[],javascriptOff:[],errors:[]};
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem('meridyen-consent','rejected'));
  page.on('pageerror',error=>findings.errors.push(error.message));
  for(let attempt=0;attempt<30;attempt++){try{await page.goto(base);break;}catch{await new Promise(resolve=>setTimeout(resolve,200));}}
  const detail=await page.locator('.lead-card h1 a').getAttribute('href');
  const paths=['/',detail,'/kategori/gundem/','/arama/','/hakkimizda/','/yonetim/','/404.html'];
  for(const width of [375,768,1440]){
    await page.setViewportSize({width,height:1000});
    for(const path of paths){
      const response=await page.goto(base+path);assert.equal(response.status(),200,path);
      await page.evaluate(()=>document.fonts.ready);
      const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(dimensions.scroll<=dimensions.width,`${path} ${width}px yatay taşma: ${dimensions.scroll}`);
      findings.layouts.push({path,width,overflow:false});
    }
  }
  for(const [name,path] of [['home','/'],['article',detail]]){
    for(const [size,width] of [['desktop',1440],['mobile',375]]){
      await page.setViewportSize({width,height:size==='desktop'?1000:812});await page.goto(base+path);await page.evaluate(()=>document.fonts.ready);
      if(size==='mobile'){
        const menu=page.locator('.mobile-menu');await menu.locator('summary').click();assert.ok(await menu.locator('a').first().isVisible());await menu.locator('summary').click();
      }
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      findings.accessibility.push({name,size,violations:axe.violations});
      await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(resolve=>setTimeout(resolve,30));}window.scrollTo(0,0);});
      await page.waitForTimeout(200);await page.screenshot({path:`artifacts/${name}-${size}.png`,fullPage:true});
    }
  }
  await page.goto(base+'/arama/?q=kütüphane');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('bulundu'));
  assert.ok(await page.locator('#search-results h2').count()>0);
  await page.locator('#arama').fill('zzzzbulunamayansözcük');await page.locator('.search-form button').click();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('bulunamadı'));
  const cookiePage=await context.newPage();await cookiePage.goto(base);await cookiePage.evaluate(()=>localStorage.removeItem('meridyen-consent'));await cookiePage.reload();await cookiePage.locator('.cookie-banner').waitFor({state:'visible'});await cookiePage.locator('[data-consent="rejected"]').click();assert.ok(!await cookiePage.locator('.cookie-banner').isVisible());assert.equal(await cookiePage.evaluate(()=>localStorage.getItem('meridyen-consent')),'rejected');await cookiePage.close();
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});const staticPage=await nojs.newPage();
  for(const path of ['/',detail,'/kategori/gundem/']){await staticPage.goto(base+path);assert.ok((await staticPage.locator('main').innerText()).length>150);assert.equal(await staticPage.locator('h1').count(),1);await staticPage.locator('.mobile-menu summary').focus();await staticPage.keyboard.press('Enter');assert.ok(await staticPage.locator('.mobile-menu nav a').first().isVisible());findings.javascriptOff.push({path,contentVisible:true,keyboardMenu:true});}
  await nojs.close();
  await page.goto(base);await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'icerik');
  const queue=['/'];const seen=new Set();
  while(queue.length){const path=queue.shift();if(seen.has(path))continue;seen.add(path);const response=await page.goto(base+path);assert.equal(response.status(),200,`Bağlantı: ${path}`);const hrefs=await page.locator('a[href^="/"]').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href').split('#')[0]));for(const href of hrefs)if(href&&!seen.has(href)&&!href.startsWith('/rss.xml')&&!href.startsWith('/arama/?'))queue.push(href);}
  findings.localPages=seen.size;
  assert.equal(findings.errors.length,0,'Tarayıcı hatası');
  const violations=findings.accessibility.flatMap(a=>a.violations);
  await writeFile('artifacts/browser-report.json',JSON.stringify(findings,null,2));
  assert.equal(violations.length,0,`Erişilebilirlik: ${violations.map(v=>v.id).join(', ')}`);
  console.log(`Tarayıcı kontrolü: ${findings.layouts.length} düzen, ${seen.size} yerel sayfa, JavaScript kapalı içerik ve arama/çerez akışı başarılı. Erişilebilirlik ihlali yok.`);
}finally{await writeFile('artifacts/browser-report.json',JSON.stringify(findings,null,2));await browser.close();}
