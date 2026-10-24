import { createHash } from 'node:crypto';
import { TIMEZONE, CATEGORIES, CATEGORY_SLUGS } from '../config.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const jsonHTML = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export const words = value => String(value ?? '').trim().split(/\s+/u).filter(Boolean);
export const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const categorySlug = category => CATEGORY_SLUGS[CATEGORIES.indexOf(category)] ?? 'gundem';
export const dateLabel = value => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIMEZONE }).format(new Date(value));
export const timeLabel = value => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE }).format(new Date(value));
export const fullDate = value => `${dateLabel(value)}, ${timeLabel(value)}`;
export const dayKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const safeURL = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
export const stripHTML = value => String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
export function sanitizeError(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const [key, value] of Object.entries(process.env)) if (/KEY|TOKEN|PASSWORD|SECRET/i.test(key) && value?.length > 5) message = message.split(value).join('[gizli]');
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [gizli]').replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, '$1[gizli]').slice(0, 500);
}
export const logError = (step, error) => console.error(JSON.stringify({ step, error: sanitizeError(error) }));
export function assertEnv(names) {
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Eksik yapılandırma: ${missing.join(', ')}`);
}
export async function getJSON(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
