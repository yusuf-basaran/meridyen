import { randomBytes } from 'node:crypto';
export function slugify(value) {
  return String(value).toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, c => ({ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}[c])).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/g, '') || 'haber';
}
export async function uniqueSlug(title, exists) {
  const base = slugify(title);
  if (!await exists(base)) return base;
  for (let i = 0; i < 10; i++) {
    const candidate = `${base.slice(0, 75).replace(/-$/g, '')}-${randomBytes(2).toString('hex')}`;
    if (!await exists(candidate)) return candidate;
  }
  throw new Error('Benzersiz haber adresi oluşturulamadı');
}
