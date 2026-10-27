import { mkdir, writeFile } from 'node:fs/promises';
import { config } from '../config.js';

const origin = config.deployment.vercelSiteURL;
if (new URL(origin).protocol !== 'https:') throw new Error('HTTPS yayın adresi gerekli.');
const checks = [];
async function get(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
  return response;
}
async function check(name, run) {
  try { await run(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: error.message }); }
}
await check('Ana sayfa ve kaynak atıfları', async () => {
  const html = await (await get('/')).text();
  if (!html.includes('Meridyen Haber') || !html.includes('source-card')) throw new Error('Kaynak akışı görünmüyor.');
  if (!html.includes('creativecommons.org/licenses/by/3.0/') || !html.includes('nasa.gov')) throw new Error('Kaynak/lisans bağlantısı eksik.');
});
await check('Yeni yayın iletişim bilgileri', async () => {
  // Give the Git integration time to deploy the new commit.
  for (let attempt = 0; attempt < 12; attempt++) {
    const html = await (await get('/iletisim/')).text();
    if (html.includes(config.contact.email)) return;
    if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Yeni iletişim bilgileri canlı dağıtıma henüz ulaşmadı.');
});
await check('Künye', async () => {
  const html = await (await get('/kunye/')).text();
  if (!html.includes(config.contact.owner) || !html.includes(config.contact.email)) throw new Error('Künye güncel değil.');
});
await check('RSS', async () => {
  const xml = await (await get('/rss.xml')).text();
  if (!xml.includes('<rss') || !xml.includes('<item>')) throw new Error('RSS kayıtları bulunamadı.');
});
await check('Arama sayfası', async () => {
  if (!(await (await get('/arama/')).text()).includes('search-results')) throw new Error('Arama sayfası eksik.');
});
await check('Kur uç noktası', async () => {
  const value = await (await get('/api/rates')).json();
  if (!value || typeof value !== 'object') throw new Error('JSON kur yanıtı alınamadı.');
});
await check('Hazırlık aşamasında arama motoru kilidi', async () => {
  if (!(await (await get('/robots.txt')).text()).includes('Disallow: /')) throw new Error('Hazırlık kilidi eksik.');
});
const report = { checkedAt: new Date().toISOString(), url: origin, ok: checks.every(check => check.ok), checks };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/public-site-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, ['## Canlı site kontrolü', '', origin, '', ...checks.map(check => '- ' + check.name + ': ' + (check.ok ? 'başarılı' : check.error))].join('\n') + '\n', { flag: 'a' });
}
if (!report.ok) process.exitCode = 1;
