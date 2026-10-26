import { readFile, writeFile, mkdir, cp, readdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';
import { SITE_NAME, CATEGORIES, config } from '../config.js';
import { demoArticles } from '../fixtures/articles.mjs';
import { staticPages } from '../lib/static-pages.mjs';
import { archiveMonths } from '../lib/archive.mjs';
import { allRows } from '../lib/supabase.mjs';
import { resolveSiteURL } from '../lib/build-settings.mjs';
import { escapeHTML as e, hash, safeURL, fullDate, jsonHTML } from '../lib/utils.mjs';
import { layout, home, articleContent, articlePath, categoryContent, categoryPath, searchContent } from '../lib/templates/pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outIndex=process.argv.indexOf('--out');
const dist = resolve(root, outIndex>=0?process.argv[outIndex+1]:'dist');
const cache = dist===resolve(root,'dist')?resolve(root,'.cache'):resolve(root,'.cache',hash(dist).slice(0,12));
const demo = process.argv.includes('--demo');
const launch = process.argv.includes('--launch');
if (demo && launch) throw new Error('Gösterim ve yayına hazırlık modları birlikte kullanılamaz.');
const siteURL = resolveSiteURL();
const publish = !demo && !launch;
if (publish && !siteURL) throw new Error('Gerçek derleme için HTTPS SITE_URL gereklidir. Vercel dışında site adresini SITE_URL ile belirtin.');
const now = demo ? '2026-10-24T12:42:00.000Z' : new Date().toISOString();
const articles = (demo ? structuredClone(demoArticles) : launch ? [] : await allRows('articles', 'id,slug,title,summary,body,category,source_name,source_url,corroborating_sources,image_url,featured,published_at,updated_at', q => q.eq('status', 'published').order('published_at', { ascending: false }).order('id'))).filter(a => a.published_at && CATEGORIES.includes(a.category));
await mkdir(dist, { recursive: true });
await mkdir(cache, { recursive: true });
await import('./assets.mjs');
await cp(resolve(root, 'public'), dist, { recursive: true, filter: path => !path.endsWith('.mjs') });
await bundle({ entryPoints: [resolve(root, 'public/js/search.mjs')], bundle: true, minify: true, format: 'esm', outfile: resolve(dist, 'js/search.js'), target: 'es2022' });
await bundle({ entryPoints: [resolve(root, 'admin/app.mjs')], bundle: true, minify: true, format: 'esm', outfile: resolve(dist, 'js/admin.js'), target: 'es2022' });

const generated = new Set();
for (const name of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (name.isFile() && !name.name.endsWith('.html') && !name.name.endsWith('.xml') && !name.name.endsWith('.json') && !['_headers','_redirects','robots.txt'].includes(name.name)) generated.add(relative(dist, resolve(name.parentPath, name.name)));
}
const pageFile = path => `${path.replace(/^\//, '').replace(/#.*$/, '')}${path.endsWith('.html') ? '' : 'index.html'}`;
async function output(path, content) {
  const name = path.startsWith('/') ? pageFile(path) : path;
  await mkdir(dirname(resolve(dist, name)), { recursive: true });
  await writeFile(resolve(dist, name), content);
  generated.add(name);
}
const common = { now, demo, siteURL, noindex: launch };
await output('_routes.json', await readFile(resolve(root,'public/_routes.json'),'utf8'));
const render = options => layout({ ...common, ...options });
const canonical = path => siteURL ? new URL(path, siteURL).href : '';

const archived = archiveMonths(articles,config.archiveAfterFiles);

await output('/', render({ title: launch ? 'Yayına hazırlanıyoruz' : 'Günün haberleri', description: launch ? 'Meridyen Haber yayına hazırlanıyor.' : 'Gündem, ekonomi, dünya, spor, teknoloji, bilim ve sağlık haberleri. Kaynak bağlantılarıyla güncel gelişmeler.', content: launch ? `<div class="page-heading"><p class="eyebrow">${e(SITE_NAME)}</p><h1>Yayına hazırlanıyoruz</h1></div><p class="empty-state">Haberlerimiz yayın hazırlıkları tamamlandıktan sonra burada yer alacak.</p>` : home(articles), active: 'Ana Sayfa', schema: publish ? { '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: SITE_NAME, url: canonical('/'), logo: canonical('/assets/logo.svg') }, { '@type': 'WebSite', name: SITE_NAME, url: canonical('/'), inLanguage: 'tr' }] } : undefined }));
const categoryURLs=[];
for (const category of CATEGORIES) {
  const group = articles.filter(a => a.category === category);
  const count = Math.max(1, Math.ceil(group.length / config.pageSize));
  for (let page=1;page<=count;page++) {
    const path = `${categoryPath(category)}${page > 1 ? `sayfa/${page}/` : ''}`;
    categoryURLs.push(path);
    await output(path, render({ title: `${category} haberleri${page > 1 ? ` — Sayfa ${page}` : ''}`, description: `${category} alanındaki gelişmeler ve kaynak bağlantıları.`, path, active: category, content: categoryContent(category, group.slice((page-1)*config.pageSize, page*config.pageSize), page, count) }));
  }
}
let previous = {};
try { previous = JSON.parse(await readFile(resolve(cache, 'build-manifest.json'), 'utf8')); } catch { /* İlk derleme. */ }
const templateHash = hash((await Promise.all(['lib/templates/pages.mjs','lib/utils.mjs','config.js'].map(path=>readFile(resolve(root,path),'utf8')))).join('\n'));
const manifest = {};
let rebuilt = 0;
for (const a of articles.filter(a => !a.archivePath)) {
  const path = articlePath(a);
  const related = [...articles.filter(b => b.id !== a.id && b.category === a.category), ...articles.filter(b => b.id !== a.id && b.category !== a.category)].slice(0, 4);
  const relatedCards=related.map(({id,slug,title,category,source_name,published_at,archivePath})=>({id,slug,title,category,source_name,published_at,archivePath}));
  const fingerprint = hash(JSON.stringify({ a, relatedCards, templateHash, demo, siteURL, SITE_NAME, day: now.slice(0,10) }));
  const name = pageFile(path);
  manifest[a.id] = { fingerprint, name };
  try { if (previous[a.id]?.fingerprint === fingerprint && (await stat(resolve(dist, name))).isFile()) { generated.add(name); continue; } } catch { /* Sayfa yeniden yazılır. */ }
  await output(path, render({ title: a.title, description: a.summary, path, active: a.category, content: articleContent({ ...a, absoluteURL: canonical(path) }, related), schema: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, description: a.summary, datePublished: a.published_at, dateModified: a.updated_at || a.published_at, inLanguage: 'tr', articleSection: a.category, mainEntityOfPage: canonical(path), image: canonical(`/assets/kapak-${categoryPath(a.category).split('/')[2]}.svg`), author: { '@type':'Organization', name: SITE_NAME }, publisher: { '@type':'Organization', name: SITE_NAME, logo: { '@type':'ImageObject', url: canonical('/assets/icon-512.png') } }, citation: safeURL(a.source_url) } }));
  rebuilt++;
}
for (const [month, group, path] of archived) {
  const content = `<div class="page-heading"><p class="eyebrow">HABER ARŞİVİ</p><h1>${e(month)} arşivi</h1></div>${group.map(a => `<section id="${e(a.slug)}">${articleContent({ ...a, absoluteURL:canonical(articlePath(a)) }, []).replace('<h1>', '<h2>').replace('</h1>', '</h2>')}</section>`).join('<hr>')}`;
  const html = render({ title: `${month} haber arşivi`, description: `${month} döneminde yayımlanan haberler.`, path, content });
  if (Buffer.byteLength(html) > 24 * 1024 * 1024) throw new Error('Aylık arşiv dosyası çok büyük; arşivi bölmeden dağıtmayın.');
  await output(path, html);
}
for (const [slug, [title, body]] of Object.entries(staticPages())) await output(`/${slug}/`, render({ title, description: `${SITE_NAME} ${title.toLocaleLowerCase('tr-TR')} sayfası.`, path: `/${slug}/`, content: `<div class="prose"><div class="page-heading"><p class="eyebrow">YAYIN BİLGİLERİ</p><h1>${e(title)}</h1></div>${body}</div>` }));
await output('/arama/', render({ title: 'Haberlerde ara', description: 'Başlık ve haber özetlerinde arama yapın.', path: '/arama/', content: searchContent(articles), noindex: true }));
await output('/404.html', render({ title: 'Sayfa bulunamadı', description: 'Aradığınız sayfa bulunamadı.', path: '/404.html', noindex: true, content: '<div class="error-page"><div class="error-code">404</div><h1>Sayfa bulunamadı</h1><p>Adres değişmiş veya haber yayından kaldırılmış olabilir.</p><a href="/">Ana sayfaya dön</a></div>' }));
if (demo) await output('/onizleme-kaynagi/', render({ title: 'Gösterim metinleri', description: 'Tasarım önizlemesinde kullanılan yerel gösterim metinleri.', path:'/onizleme-kaynagi/', noindex:true, content:`<div class="prose"><h1>Gösterim metinleri</h1><p>Bu önizlemedeki haberler tasarımı göstermek için hazırlanmıştır. Gerçek olay veya kurum açıklaması olarak değerlendirilmemelidir. Bu sayfa bir RSS kaynağı değildir.</p>${articles.map(a => `<article id="${e(a.slug)}"><h2>${e(a.title)}</h2><p>${e(a.summary)}</p></article>`).join('')}</div>` }));
const adminHTML = await readFile(resolve(root, 'admin/index.html'), 'utf8');
await output('/yonetim/', render({ title: 'Yayın yönetimi', description: 'Yetkili yayın yönetimi.', path: '/yonetim/', content: adminHTML, noindex: true, admin: true }));
const anonKey = launch ? '' : process.env.SUPABASE_ANON_KEY || '';
if (anonKey && !anonKey.startsWith('sb_publishable_')) {
  try { if (JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error(); } catch { throw new Error('Tarayıcı yapılandırmasında yalnızca anonim veya yayımlanabilir anahtar kullanılabilir.'); }
}
await output('public-config.json', jsonHTML({ supabaseURL: launch ? '' : safeURL(process.env.SUPABASE_URL), supabaseKey: anonKey, repository: /^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '') ? process.env.GITHUB_REPOSITORY : '' }));
await output('search-index.json', JSON.stringify(articles.map(a => ({ id: a.id, title: a.title, summary: a.summary, category: a.category, path: articlePath(a) }))));
const indexedPaths = ['/', ...categoryURLs, ...Object.keys(staticPages()).map(s => `/${s}/`), ...articles.filter(a => !a.archivePath).map(articlePath), ...archived.map(([, , path]) => path)];
await output('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${siteURL && publish ? indexedPaths.map(path => `<url><loc>${e(canonical(path))}</loc></url>`).join('') : ''}</urlset>`);
await output('news-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${siteURL && publish ? articles.filter(a => !a.archivePath && Date.parse(a.published_at) >= Date.parse(now)-48*3600000 && Date.parse(a.published_at) <= Date.parse(now)).slice(0,1000).map(a => `<url><loc>${e(canonical(articlePath(a)))}</loc><news:news><news:publication><news:name>${e(SITE_NAME)}</news:name><news:language>tr</news:language></news:publication><news:publication_date>${e(a.published_at)}</news:publication_date><news:title>${e(a.title)}</news:title></news:news></url>`).join('') : ''}</urlset>`);
await output('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${e(SITE_NAME)}</title><link>${e(canonical('/'))}</link><description>Son haberler</description><language>tr</language>${siteURL && publish ? articles.slice(0,100).map(a => `<item><title>${e(a.title)}</title><link>${e(canonical(articlePath(a)))}</link><guid isPermaLink="false">${e(a.id)}</guid><pubDate>${new Date(a.published_at).toUTCString()}</pubDate><description>${e(a.summary)}</description></item>`).join('') : ''}</channel></rss>`);
await output('robots.txt', demo || launch ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /yonetim/\nDisallow: /arama/\nSitemap: ${canonical('/sitemap.xml')}\n`);
await output('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'${safeURL(process.env.SUPABASE_URL) ? ` ${new URL(process.env.SUPABASE_URL).origin}` : ''}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'\n/yonetim/*\n  X-Robots-Tag: noindex, nofollow\n/public-config.json\n  Cache-Control: no-cache\n/search-index.json\n  Cache-Control: public, max-age=300\n`);
await output('_redirects', archived.map(([month]) => `/haber/${month.replace('-', '/')}/:slug/ /arsiv/${month.replace('-', '/')}/#:slug 301`).join('\n') + '\n');
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) {
    const file = resolve(entry.parentPath, entry.name);
    if (!generated.has(relative(dist, file))) await rm(file);
  }
}
await writeFile(resolve(cache, 'build-manifest.json'), JSON.stringify(manifest));
const buildResult={ demo,launch,testFixture:process.env.MERIDYEN_BUILD_TEST==='1',articles: articles.length,rebuilt,files:generated.size,builtAt:new Date().toISOString() };
await writeFile(resolve(cache, 'build-result.json'), JSON.stringify(buildResult,null,2));
if(process.env.MERIDYEN_BUILD_TEST==='1')await writeFile(resolve(dist,'test-fixture.json'),JSON.stringify(buildResult));
console.log(`${demo ? 'Gösterim' : launch ? 'Yayına hazırlık' : 'Yayın'} derlemesi: ${articles.length} haber, ${rebuilt} haber sayfası yazıldı, ${generated.size} dosya.`);
