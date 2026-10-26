import { readFile } from 'node:fs/promises';
import { fetchFeed } from './rss.mjs';
import { hash, safeURL, stripHTML, words } from './utils.mjs';

export const FREE_FEED_MAX_AGE_DAYS = 14;
export const freeSources = JSON.parse(await readFile(new URL('../free-sources.json', import.meta.url), 'utf8'));

export function normalizeFreeItems(items, source, now = Date.now()) {
  if (!source.active || !source.terms_confirmed || !safeURL(source.license_url)) return [];
  const seen = new Set();
  return items.flatMap(item => {
    const url = safeURL(item.url);
    if (!url || item.reuseRestricted) return [];
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== source.allowed_host || parsed.port || !new RegExp(source.path_pattern).test(parsed.pathname)) return [];
    parsed.hash = ''; parsed.search = '';
    const canonical = parsed.href;
    const date = Date.parse(item.publishedAt);
    if (!Number.isFinite(date) || date > now + 5 * 60_000 || date < now - FREE_FEED_MAX_AGE_DAYS * 86400_000 || seen.has(canonical)) return [];
    const title = stripHTML(item.title).slice(0, 300);
    const author = stripHTML(item.author).slice(0, 200);
    const excerpt = stripHTML(item.excerpt ?? item.summary);
    if (!title || !excerpt || (source.author_required && !author)) return [];
    if (/sponsored|advertisement|horoscope/i.test(title)) return [];
    const excerptWords = words(excerpt);
    const summary = excerptWords.slice(0, 60).join(' ') + (excerptWords.length > 60 ? '…' : '');
    seen.add(canonical);
    return [{ id: `free-${source.id}-${hash(canonical).slice(0, 16)}`, sourceId: source.id, sourceName: source.name, author: author || source.name, title, summary, url: canonical, category: source.category, language: source.language, publishedAt: new Date(date).toISOString(), licenseName: source.license_name, licenseURL: source.license_url, termsURL: source.terms_url }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 10);
}

export function snapshotItems(snapshot, now = Date.now()) {
  return freeSources.flatMap(source => normalizeFreeItems((snapshot.items || []).filter(item => item.sourceId === source.id), source, now))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function refreshFreeFeed(previous = {}, { now = new Date().toISOString(), fetcher = fetchFeed } = {}) {
  const items = [], statuses = [];
  const sources = freeSources.filter(source => source.active && source.terms_confirmed);
  const results = await Promise.allSettled(sources.map(source => fetcher(source.feed_url)));
  for (const [index, source] of sources.entries()) {
    const result = results[index];
    if (result.status === 'fulfilled') {
      const entries = normalizeFreeItems(result.value, source, Date.parse(now));
      items.push(...entries); statuses.push({ sourceId: source.id, ok: true, items: entries.length });
    } else {
      const entries = normalizeFreeItems((previous.items || []).filter(item => item.sourceId === source.id), source, Date.parse(now));
      items.push(...entries); statuses.push({ sourceId: source.id, ok: false, items: entries.length });
    }
  }
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (JSON.stringify({ items, sources: statuses }) === JSON.stringify({ items: previous.items, sources: previous.sources })) return previous;
  return { updatedAt: now, items, sources: statuses };
}
