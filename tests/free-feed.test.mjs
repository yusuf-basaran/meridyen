import test from 'node:test';
import assert from 'node:assert/strict';
import { freeSources, normalizeFreeItems, snapshotItems, refreshFreeFeed } from '../lib/free-feed.mjs';
import { freeFeedCard } from '../lib/templates/free-feed.mjs';
import { parseFeed } from '../lib/rss.mjs';

const now = '2026-10-26T18:00:00Z';
const source = freeSources[0];
const item = { title: 'A source headline', excerpt: 'An original source description.', author: 'Original Writer', url: 'https://globalvoices.org/2026/10/26/example/', publishedAt: '2026-10-26T10:00:00Z' };

test('Ücretsiz kaynak akışı izin, yazar, yayıncı adresi ve güncellik koşullarını uygular', () => {
  const normalize = (items, registry=source) => normalizeFreeItems(items, registry, Date.parse(now));
  assert.equal(normalize([item]).length, 1);
  for (const change of [{ url: 'https://evil.example/2026/10/26/example/' }, { url: 'http://globalvoices.org/2026/10/26/example/' }, { url: 'https://globalvoices.org/about/' }, { author: '' }, { publishedAt: '2021-04-18' }, { publishedAt: '2026-11-01' }, { publishedAt: null }, { reuseRestricted: true }]) {
    assert.equal(normalize([{ ...item, ...change }]).length, 0);
  }
  assert.equal(normalize([item], { ...source, terms_confirmed: false }).length, 0);
  assert.equal(normalize([item], { ...source, active: false }).length, 0);
  assert.equal(normalize([item, { ...item, url: item.url + '?tracking=1#part' }]).length, 1);
  const nasa=freeSources[1];
  assert.equal(normalize([{...item,url:'https://www.nasa.gov/image-article/example/'}],nasa).length,0);
});

test('Alıntı 60 kelimeyle sınırlıdır; kaynak/yazar/lisans üstte ve güvenli HTML ile gösterilir', () => {
  const [entry] = normalizeFreeItems([{ ...item, excerpt: Array(100).fill('word').join(' '), title: '<img src=x onerror=alert(1)>Title & more', author: 'Writer <script>bad()</script>' }], source, Date.parse(now));
  assert.equal(entry.summary.split(/\s+/).length, 60);
  const html = freeFeedCard(entry);
  assert.ok(html.includes('CC BY 3.0'));
  assert.ok(html.includes('RSS’den kısaltılmış alıntı'));
  assert.ok(html.includes('lang="en"'));
  assert.ok(html.indexOf('Original Writer') < 0);
  assert.ok(html.indexOf('Writer') < html.indexOf('<h2'));
  assert.ok(!html.includes('onerror'));
  assert.ok(!html.includes('bad()'));
  assert.ok(html.includes('Title &amp; more'));
});

test('RSS yazarını ve sayısal karakterleri korur; farklı lisans/yeniden yayın bildirimini ayıklar', () => {
  const xml = `<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title><![CDATA[World&#8217;s news]]></title><link>${item.url}</link><dc:creator>Original Writer</dc:creator><description>Description</description><content:encoded><![CDATA[Republished with permission from another publisher.]]></content:encoded></item></channel></rss>`;
  const [entry] = parseFeed(xml);
  assert.equal(entry.title, 'World’s news');
  assert.equal(entry.author, 'Original Writer');
  assert.equal(entry.reuseRestricted, true);
  const ownFooter = `<p class='originally-published'><small>Originally published on <a href='${item.url}'>Global Voices</a></small></p>`;
  assert.equal(parseFeed(xml.replace('Republished with permission from another publisher.', ownFooter))[0].reuseRestricted, false);
  assert.equal(parseFeed(xml.replace('Republished with permission from another publisher.', ownFooter.replace(item.url, 'https://another-publisher.example/story')))[0].reuseRestricted, true);
});

test('Kaynak hatası diğer kaynağı durdurmaz; eski kayıtlar 14 gün sonra düşer', async () => {
  const previous={items:[{...item,sourceId:source.id,summary:item.excerpt}]};
  const snapshot=await refreshFreeFeed(previous,{now,fetcher:async url=>{
    if(url.includes('globalvoices'))throw new Error('timeout');
    return [{...item,url:'https://www.nasa.gov/news-release/test/',author:'NASA Writer'}];
  }});
  assert.equal(snapshot.items.length,2);
  assert.equal(snapshot.sources[0].ok,false);
  assert.equal(snapshot.sources[1].ok,true);
  assert.equal(snapshotItems(snapshot,Date.parse('2026-12-01')).length,0);
  const same=await refreshFreeFeed(snapshot,{now,fetcher:async url=>{
    if(url.includes('globalvoices'))throw new Error('timeout');
    return [{...item,url:'https://www.nasa.gov/news-release/test/',author:'NASA Writer'}];
  }});
  assert.equal(same,snapshot);
});
