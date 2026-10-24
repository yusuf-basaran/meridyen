import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchPublic, limitedText } from './network.mjs';
import { config } from '../config.js';
import { stripHTML, safeURL } from './utils.mjs';
const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_', processEntities:true, isArray:name=>['item','entry'].includes(name) });
const text = value => typeof value === 'object' ? value?.['#text'] || '' : value || '';
export function parseFeed(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('Geçersiz veya desteklenmeyen RSS XML');
  const feed=parser.parse(xml);
  const entries=feed.rss?.channel?.item || feed['rdf:RDF']?.item || feed.feed?.entry;
  if(!Array.isArray(entries))throw new Error('Yanıtta RSS veya Atom öğeleri bulunamadı');
  return entries.map(item=>{
    const links=Array.isArray(item.link)?item.link:[item.link];
    const url=links.map(link=>typeof link==='object'?link['@_href']||text(link):link).find(link=>safeURL(link));
    const rawDate=text(item.pubDate||item.published||item.updated||item['dc:date']);
    return { title:stripHTML(text(item.title)),excerpt:stripHTML(text(item.description||item.summary||item['content:encoded']||item.content)),url:safeURL(url),publishedAt:rawDate&&Number.isFinite(Date.parse(rawDate))?new Date(rawDate).toISOString():null };
  }).filter(item=>item.url&&item.title);
}
export async function fetchFeed(url) {
  const response=await fetchPublic(url,{signal:AbortSignal.timeout(config.feedTimeoutMs),headers:{'User-Agent':'MeridyenHaber/1.0 (RSS reader)','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'}});
  return parseFeed(await limitedText(response));
}
export function filterItem(item) {
  if(/reklam|kampanya|indirim|burç|çekiliş|sponsorlu|advertisement|sponsored|horoscope|giveaway/u.test(item.title.toLocaleLowerCase('tr-TR')))return false;
  return item.excerpt.length>=config.minExcerptLength;
}
