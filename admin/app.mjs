import { createClient } from '@supabase/supabase-js';
import { CATEGORIES } from '../config.js';
const $ = selector => document.querySelector(selector);
const message = text => { $('#admin-message').textContent = text; };
const labels = { pending:'Bekliyor', auto_pass:'Yayına uygun', needs_review:'İnceleme gerekli', auto_reject:'Reddedildi', draft:'Taslak', published:'Yayında', rejected:'Reddedildi' };
let db, selected, sources = [], articles = [];
function el(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = String(text); if (className) node.className = className; return node; }
function result(response) { if (response.error) throw new Error('İşlem tamamlanamadı. Yetki ve bağlantı bilgilerini kontrol edin.'); return response.data; }
const dayStart = () => { const date = new Date(); const parts = new Intl.DateTimeFormat('en-CA',{ timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit' }).format(date); return `${parts}T00:00:00+03:00`; };
function date(value) { return value ? new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—'; }
for (const select of document.querySelectorAll('select[name="category"]')) for (const category of CATEGORIES) { const option = el('option',category); option.value=category; select.append(option); }
async function authenticate() {
  const response = await db.auth.getUser();
  if (response.error || !response.data.user) { $('#login-section').hidden = false; $('#admin-dashboard').hidden = true; return; }
  const allowed = result(await db.rpc('is_admin'));
  if (!allowed) { await db.auth.signOut(); message('Bu hesabın yayın yönetimine erişimi bulunmuyor.'); return; }
  $('#login-section').hidden = true; $('#admin-dashboard').hidden = false;
  $('#admin-identity').textContent = response.data.user.email;
  message(''); await load();
}
async function load() {
  const [articleResponse, sourceResponse, usageResponse, runResponse, logResponse] = await Promise.all([
    db.from('articles').select('*').order('created_at',{ascending:false}).limit(100),
    db.from('sources').select('*').order('name'),
    db.from('llm_usage').select('*').eq('day',dayStart().slice(0,10)),
    db.from('pipeline_runs').select('*').order('started_at',{ascending:false}).limit(20),
    db.from('verification_log').select('issues').order('created_at',{ascending:false}).limit(200)
  ]);
  articles = result(articleResponse); sources = result(sourceResponse);
  const priority = a => (a.verdict === 'needs_review' ? 0 : a.status === 'draft' ? 2 : 4) + (a.sensitivity === 'hassas' ? 0 : 1);
  articles.sort((a,b)=>priority(a)-priority(b));
  const tbody = $('#draft-list'); tbody.replaceChildren();
  for (const a of articles) {
    const row=el('tr'), title=el('td',a.title);
    if(a.sensitivity==='hassas') title.append(el('span','HASSAS','risk-label'));
    const state=el('td');state.append(el('span',null,`status-dot ${a.verdict}`),document.createTextNode(labels[a.verdict] || a.verdict),el('p',labels[a.status] || a.status));
    const action=el('td'); const open=el('button','Düzenle');open.type='button';open.addEventListener('click',()=>edit(a).catch(()=>message('Haber açılamadı.')));action.append(open);
    row.append(title,el('td',a.category),el('td',a.source_name),state,action);tbody.append(row);
  }
  if(!articles.length){const row=el('tr');const cell=el('td','Henüz haber bulunmuyor.');cell.colSpan=5;row.append(cell);tbody.append(row);}
  await statistics(); renderSources();
  const runs=$('#run-list');runs.replaceChildren();
  for(const run of result(runResponse)){const row=el('div',null,'run-row');row.append(el('strong',`${run.step} — ${run.success ? 'Tamamlandı' : 'Hata'}`),el('p',date(run.finished_at || run.started_at)));runs.append(row);}
  if(!runs.childNodes.length)runs.append(el('p','Henüz çalışma kaydı bulunmuyor.','admin-note'));
  $('#usage-list').replaceChildren(...result(usageResponse).map(u=>el('p',`${u.provider}: ${u.count} / 800`)));
  if(!$('#usage-list').childNodes.length)$('#usage-list').textContent='Bugün istek kaydı bulunmuyor.';
  const counts={};for(const log of result(logResponse))for(const issue of Array.isArray(log.issues)?log.issues:[])if(issue.type)counts[issue.type]=(counts[issue.type]||0)+1;
  $('#issue-stats').replaceChildren(...Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>el('p',`${type}: ${count}`)));
  if(!Object.keys(counts).length)$('#issue-stats').textContent='Sorun kaydı bulunmuyor.';
}
async function statistics(){
  const queries=[['Bugün eklenen',q=>q.gte('created_at',dayStart())],['Bugün yayımlanan',q=>q.eq('status','published').gte('published_at',dayStart())],['Bugün reddedilen',q=>q.eq('status','rejected').gte('updated_at',dayStart())],['Yayına uygun',q=>q.eq('verdict','auto_pass')],['İnceleme gerekli',q=>q.eq('verdict','needs_review')],['Reddedilen karar',q=>q.eq('verdict','auto_reject')]];
  const stats=await Promise.all(queries.map(async([label,apply])=>{const response=await apply(db.from('articles').select('id',{count:'exact',head:true}));result(response);return[label,response.count];}));
  $('#stats').replaceChildren(...stats.map(([label,count])=>{const node=el('div',null,'stat');node.append(el('strong',count),el('span',label));return node;}));
}
function renderSources(){
  const list=$('#source-list');list.replaceChildren();
  for(const source of sources){
    const row=el('div',null,'source-row'),copy=el('div');copy.append(el('strong',source.name),el('p',`${source.category} · Güven ${source.trust_level} · ${source.active?'Aktif':'Pasif'}`),el('p',source.feed_url));
    const actions=el('div',null,'source-actions');
    const editButton=el('button','Düzenle');editButton.type='button';editButton.className='secondary';editButton.addEventListener('click',()=>{const form=$('#source-form');for(const [key,value] of Object.entries(source)){const input=form.elements.namedItem(key);if(input)input.type==='checkbox'?input.checked=Boolean(value):input.value=value??'';}form.elements.name.focus();});
    const toggle=el('button',source.active?'Pasif yap':'Aktif yap');toggle.type='button';toggle.className='secondary';toggle.addEventListener('click',async()=>{try{if(!source.active&&!source.terms_confirmed)throw new Error('Önce kullanım koşullarını ve izni kaydedin.');result(await db.from('sources').update({active:!source.active}).eq('id',source.id));await load();}catch(error){message(error.message);}});
    const remove=el('button','Sil');remove.type='button';remove.className='danger';remove.addEventListener('click',async()=>{if(!window.confirm(`${source.name} kaynağı silinsin mi?`))return;try{result(await db.from('sources').delete().eq('id',source.id));await load();}catch(error){message(error.message);}});
    actions.append(editButton,toggle,remove);row.append(copy,actions);list.append(row);
  }
  if(!sources.length)list.append(el('p','Henüz kaynak eklenmemiş.','admin-note'));
}
async function edit(a){
  selected=a;const form=$('#article-form');for(const key of ['title','summary','body','category'])form.elements.namedItem(key).value=a[key]||'';form.elements.featured.checked=a.featured;
  $('#edit-message').textContent='';$('#review-override').checked=false;$('#review-reason').value='';$('#override-fields').hidden=a.verdict==='auto_pass'&&a.sensitivity==='normal';
  const evidence=$('#article-evidence');evidence.replaceChildren(el('h3','Kaynaklar ve inceleme'));
  const original=sources.find(s=>s.id===a.source_id);const publisherKeys=new Set([original?.publisher_key].filter(Boolean));
  const sourceLink=(name,url)=>{let parsed;try{parsed=new URL(url);}catch{return el('span',name);}if(!['http:','https:'].includes(parsed.protocol))return el('span',name);const link=el('a',name);link.href=url;link.rel='nofollow noopener';link.target='_blank';return link;};
  evidence.append(sourceLink(a.source_name,a.source_url));
  for(const source of a.corroborating_sources||[]){const stored=sources.find(s=>s.id===source.source_id);if(stored)publisherKeys.add(stored.publisher_key);evidence.append(el('br'),sourceLink(source.name,source.url));}
  if(publisherKeys.size<2)evidence.append(el('p','Tek kaynak. Hassas haber iki bağımsız kaynak olmadan yayımlanamaz.','risk-label'));
  if(a.verification?.edited)evidence.append(el('p','Metin son incelemeden sonra değiştirildi. Önceki denetim bulguları eski metne aittir.','risk-label'));
  if(a.verification&&a.verification.independent!==true)evidence.append(el('p','Model incelemeleri bağımsız sağlayıcı koşulunu karşılamıyor. Kaynakla uyum puanı tek başına yayın onayı değildir; editör incelemesi gerekir.','risk-label'));
  const logs=result(await db.from('verification_log').select('*').eq('article_id',a.id).order('created_at',{ascending:false}));
  for(const log of logs){evidence.append(el('h3',`${log.role} · ${log.verdict || 'Kayıt'}`));if(log.provider)evidence.append(el('p',`${log.provider} / ${log.model || '—'}`,'admin-note'));for(const issue of Array.isArray(log.issues)?log.issues:[]){evidence.append(el('p',[issue.type,issue.severity].filter(Boolean).join(' · ')),el('blockquote',issue.text || 'Kayıt ayrıntısı bulunmuyor.'));}}
  $('#publish').disabled=a.status==='published'||a.status==='pending'||(a.sensitivity==='hassas'&&publisherKeys.size<2);$('#reject').disabled=a.status==='rejected';
  if(!$('#article-dialog').open)$('#article-dialog').showModal();
}
$('#login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const form=event.currentTarget;const response=await db.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});form.elements.password.value='';if(response.error)throw new Error('Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.');await authenticate();}catch(error){message(error.message);}finally{button.disabled=false;}});
$('#logout').addEventListener('click',async()=>{await db.auth.signOut();$('#admin-dashboard').hidden=true;$('#login-section').hidden=false;$('#draft-list').replaceChildren();selected=null;});
$('#reload').addEventListener('click',()=>load().catch(error=>message(error.message)));
$('#close-dialog').addEventListener('click',()=>$('#article-dialog').close());
for(const button of document.querySelectorAll('[data-panel]'))button.addEventListener('click',()=>{for(const panel of document.querySelectorAll('[data-admin-panel]'))panel.hidden=panel.dataset.adminPanel!==button.dataset.panel;for(const tab of document.querySelectorAll('[data-panel]')){const active=tab===button;tab.setAttribute('aria-pressed',String(active));tab.classList.toggle('secondary',!active);}});
$('#source-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));if(!data.feed_url.startsWith('https://'))throw new Error('RSS adresi HTTPS olmalıdır.');const payload={name:data.name.trim(),feed_url:data.feed_url.trim(),category:data.category,trust_level:Number(data.trust_level),publisher_key:data.publisher_key.trim().toLocaleLowerCase('tr-TR'),terms_url:data.terms_url||null,terms_confirmed:form.elements.terms_confirmed.checked,active:form.elements.active.checked};if(payload.active&&(!payload.terms_confirmed||!payload.terms_url))throw new Error('Aktif kaynak için kullanım koşulları adresi ve izin kontrolü gerekir.');result(await(data.id?db.from('sources').update(payload).eq('id',data.id):db.from('sources').insert(payload)));form.reset();await load();message('Kaynak kaydedildi. RSS erişimi haber toplama sırasında kontrol edilir.');}catch(error){message(error.message);}finally{button.disabled=false;}});
$('#source-form').addEventListener('reset',()=>{setTimeout(()=>{$('#source-form').elements.id.value='';},0);});
$('#article-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const form=event.currentTarget;const payload=Object.fromEntries(new FormData(form));payload.featured=form.elements.featured.checked;payload.status='draft';const saved=result(await db.from('articles').update(payload).eq('id',selected.id).select().single());await edit(saved);$('#edit-message').textContent='Taslak kaydedildi. Değişen metin yeniden inceleme gerektirir.';await load();}catch(error){$('#edit-message').textContent=error.message;}finally{button.disabled=false;}});
async function decide(status){
  const button=status==='published'?$('#publish'):$('#reject');button.disabled=true;
  try{
    const form=$('#article-form');const dirty=['title','summary','body','category'].some(key=>form.elements.namedItem(key).value!==(selected[key]||''))||form.elements.featured.checked!==selected.featured;
    if(dirty)throw new Error('Önce taslak değişikliklerini kaydedin.');
    if(status==='published'&&(selected.verdict!=='auto_pass'||selected.sensitivity==='hassas')&&(!$('#review-override').checked||$('#review-reason').value.trim().length<10))throw new Error('İnceleme onayı ve en az 10 karakterlik gerekçe gerekir.');
    const payload={status,review_override:$('#review-override').checked,review_reason:$('#review-reason').value.trim()||null};
    const response=await db.from('articles').update(payload).eq('id',selected.id).select().single();
    if(response.error)throw new Error('İşlem reddedildi. Kaynak sayısını, inceleme gerekçesini ve yayın koşullarını kontrol edin.');
    $('#article-dialog').close();await load();message(status==='published'?'Haber yayın kuyruğuna alındı.':'Haber reddedildi.');
  }catch(error){$('#edit-message').textContent=error.message;button.disabled=false;}
}
$('#publish').addEventListener('click',()=>decide('published'));$('#reject').addEventListener('click',()=>decide('rejected'));
try{
  const response=await fetch('/public-config.json');if(!response.ok)throw new Error();const settings=await response.json();
  if(!settings.supabaseURL||!settings.supabaseKey){message('Yönetici girişi için bağlantı yapılandırması henüz eklenmemiş.');$('#login-form').querySelector('button').disabled=true;}
  else{db=createClient(settings.supabaseURL,settings.supabaseKey);await authenticate();db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){if($('#article-dialog').open)$('#article-dialog').close();$('#admin-dashboard').hidden=true;$('#login-section').hidden=false;}});}
  if(settings.repository&&/^[\w.-]+\/[\w.-]+$/.test(settings.repository)){const link=el('a','GitHub iş akışı kayıtlarını aç');link.href=`https://github.com/${settings.repository}/actions/workflows/pipeline.yml`;link.target='_blank';link.rel='noopener';$('#workflow-link').append(link);}
}catch{message('Yönetim bağlantısı kurulamadı. Lütfen daha sonra yeniden deneyin.');}
