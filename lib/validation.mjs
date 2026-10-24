import { CATEGORIES } from '../config.js';
import { words } from './utils.mjs';
export const REVIEW_TYPES = ['uydurma','celiski','abarti','sayi_tarih','isim','atif_eksik'];
export function validateWriter(output) {
  if(!output||typeof output.skip!=='boolean'||typeof output.skip_reason!=='string')return false;
  if(output.skip)return true;
  return typeof output.title==='string'&&output.title.trim().length>0&&output.title.length<=90&&typeof output.summary==='string'&&words(output.summary).length>0&&words(output.summary).length<=60&&typeof output.body==='string'&&words(output.body).length>=120&&words(output.body).length<=180&&output.body.split(/\n\s*\n/).length>=2&&output.body.split(/\n\s*\n/).length<=3&&CATEGORIES.includes(output.category)&&['normal','hassas'].includes(output.sensitivity);
}
export function validateReview(output) {
  return !!output&&['pass','fail'].includes(output.verdict)&&Number.isInteger(output.score)&&output.score>=0&&output.score<=100&&Array.isArray(output.issues)&&output.issues.every(i=>i&&typeof i.text==='string'&&i.text.length>0&&REVIEW_TYPES.includes(i.type)&&['dusuk','orta','yuksek'].includes(i.severity))&&!(output.verdict==='pass'&&output.issues.length>0);
}
export function detectSensitivity(text) {
  const value=String(text).toLocaleLowerCase('tr-TR');
  const risky=/(?:^|[^\p{L}])(?:ölüm\p{L}*|öldür\p{L}*|hayatını\s+kaybet\p{L}*|saldırı\p{L}*|savaş\p{L}*|kaza(?:sı|sında|da|lar|ların|nın|ya)?|yaralı\p{L}*|tıbbi|tedavi\p{L}*|ilaç\p{L}*|hastalık\p{L}*|aşı(?:sı|nın|ya|lar|ları|lama\p{L}*)?|seçim\p{L}*|suç\p{L}*|şüpheli\p{L}*|cinayet\p{L}*|death\p{L}*|killed|attack\p{L}*|war|election\p{L}*|murder\p{L}*|medical|vaccine\p{L}*)(?=$|[^\p{L}])/u;
  return risky.test(value)||/\d[\d.,]*\s*(?:milyon|milyar|bin|lira|tl\b|dolar|euro|sterlin|yüzde|%|million|billion|dollar|percent)|[%$€₺]\s*\d/u.test(value) ? 'hassas' : 'normal';
}
