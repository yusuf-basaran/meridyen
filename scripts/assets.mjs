import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { CATEGORIES, CATEGORY_SLUGS, SITE_NAME } from '../config.js';
import { escapeHTML } from '../lib/utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'public/assets');
await mkdir(assets, { recursive: true });
const badge = '<rect width="48" height="48" fill="#0F2A4A"/><path d="M12 36V12h4l8 12 8-12h4v24h-4V19l-8 12-8-12v17z" fill="#F7F5F0"/><rect y="44" width="48" height="4" fill="#B3122B"/>';
const rawLogo = `<svg viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">${badge}<text x="62" y="26" font-family="Source Serif 4, Georgia, serif" font-size="22" font-weight="700" fill="#0F2A4A" letter-spacing="2">MERİDYEN</text><text x="62" y="42" font-family="Source Sans 3, Arial, sans-serif" font-size="11" letter-spacing="5" fill="#B3122B">HABER</text></svg>`;
const sansBuffer = await readFile(resolve(root, 'lib/fonts/sans.ttf'));
const sans = opentype.parse(sansBuffer.buffer.slice(sansBuffer.byteOffset, sansBuffer.byteOffset + sansBuffer.byteLength));
const serifBuffer = await readFile(resolve(root, 'lib/fonts/serif.ttf'));
const serifFont = opentype.parse(serifBuffer.buffer.slice(serifBuffer.byteOffset, serifBuffer.byteOffset + serifBuffer.byteLength));
function outline(font, text, x, baseline, size, spacing, fill) {
  let position = x;
  let d = '';
  for (const character of text) {
    const glyph = font.charToGlyph(character);
    d += glyph.getPath(position, baseline, size).toPathData(2);
    position += glyph.advanceWidth * size / font.unitsPerEm + spacing;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}
const nameParts = SITE_NAME.trim().split(/\s+/);
const lowerLine = nameParts.length > 1 ? nameParts.pop() : 'HABER';
const upperLine = nameParts.join(' ') || SITE_NAME;
const wordmark = outline(serifFont, upperLine.toLocaleUpperCase('tr-TR'), 62, 26, upperLine.length > 9 ? 17 : 22, 1.7, '#0F2A4A') + outline(sans, lowerLine.toLocaleUpperCase('tr-TR'), 63, 42, 11, 5, '#B3122B');
const logo = `<svg viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHTML(SITE_NAME)}">${badge}${wordmark}</svg>`;
await writeFile(resolve(assets, 'logo-source.svg'), rawLogo);
await writeFile(resolve(assets, 'logo.svg'), logo);
const favicon = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${badge}</svg>`;
await writeFile(resolve(assets, 'favicon.svg'), favicon);
for (const [name, size] of [['favicon-32.png',32],['apple-touch-icon.png',180],['icon-512.png',512]]) await sharp(Buffer.from(favicon)).resize(size,size).png().toFile(resolve(assets,name));
await sharp(Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#F7F5F0"/><rect y="610" width="1200" height="20" fill="#0F2A4A"/><g transform="translate(180 215) scale(3.8)">${badge}${wordmark}</g></svg>`)).png().toFile(resolve(assets, 'og.png'));

const grid = `<path d="M0 135H960M0 270H960M0 405H960M240 0V540M480 0V540M720 0V540" stroke="#F7F5F0" stroke-opacity=".06"/>`;
const motifs = [
  `<g fill="none" stroke="#B2C0CC"><path d="M155 410V245h95v165m-65 0V185h75v225m20 0V278h120v132m-80-132v-72h50v72m70 132V130h100v280m-75-280v-30h50v30m65 280V220h100v190m30 0V170h90v240m-70-240v-28h50v28m45 268H100"/><path d="M116 448h730M116 458h730M202 235v153m25-153v153M305 300v87m25-87v87m25-87v87M447 155v232m25-232v232m25-232v232m76-140v140m25-140v140m25-140v140m66-188v188m25-188v188m25-188v188" stroke-opacity=".5"/><path d="M130 470C310 365 515 518 835 349" stroke="#B08D57" stroke-width="2"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><path d="M145 415V165m0 250h680M185 375l92-62 90 19 110-107 93 28 100-105 112 41" stroke-width="2"/><path d="M185 415V375m92 40V313m90 102v-83m110 83V225m93 190V253m100 162V148m112 267V189" stroke-opacity=".4"/><path d="M145 215h680M145 315h680" stroke-opacity=".15"/><circle cx="477" cy="225" r="9" fill="#0F2A4A" stroke="#B08D57"/><circle cx="670" cy="148" r="9" fill="#0F2A4A" stroke="#B08D57"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><circle cx="480" cy="280" r="185"/><ellipse cx="480" cy="280" rx="100" ry="185"/><ellipse cx="480" cy="280" rx="165" ry="185"/><path d="M295 280h370M313 200h334M313 360h334M480 95v370" stroke-opacity=".7"/><path d="M192 372C313 165 694 104 786 254M204 166C395 427 646 425 792 340" stroke="#B08D57" stroke-opacity=".7"/><circle cx="640" cy="189" r="7" fill="#B08D57" stroke="none"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><rect x="220" y="140" width="520" height="300"/><rect x="255" y="175" width="450" height="230"/><path d="M480 175v230M255 290h85m365 0h-85"/><circle cx="480" cy="290" r="70"/><path d="M220 125V95h520v30M205 140h-35v300h35M755 140h35v300h-35" stroke-opacity=".35"/><path d="M337 210l89 48 105-28 75 135" stroke="#B08D57" stroke-width="2"/><circle cx="337" cy="210" r="7" fill="#0F2A4A"/><circle cx="606" cy="365" r="7" fill="#0F2A4A"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><rect x="337" y="140" width="286" height="286"/><rect x="377" y="180" width="206" height="206"/><path d="M377 180l206 206m-206 0 206-206M337 210H190v-75m147 130H130m207 80H180v85m443-220h147v-75m-147 130h207m-207 80h157v85M407 140V80m73 60V80m73 60V80M407 426v65m73-65v65m73-65v65" stroke-opacity=".7"/><circle cx="480" cy="283" r="53" stroke="#B08D57"/><circle cx="190" cy="135" r="7"/><circle cx="180" cy="430" r="7"/><circle cx="770" cy="135" r="7"/><circle cx="780" cy="430" r="7"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><circle cx="480" cy="280" r="36" stroke="#B08D57"/><ellipse cx="480" cy="280" rx="245" ry="80"/><ellipse cx="480" cy="280" rx="245" ry="80" transform="rotate(60 480 280)"/><ellipse cx="480" cy="280" rx="245" ry="80" transform="rotate(120 480 280)"/><circle cx="725" cy="280" r="8" fill="#B08D57" stroke="none"/><circle cx="359" cy="68" r="7" fill="#B7C6D1"/><path d="M180 425h70m-35-35v70M730 115h40m-20-20v40" stroke-opacity=".5"/></g>`,
  `<g fill="none" stroke="#B7C6D1"><circle cx="480" cy="280" r="180"/><circle cx="480" cy="280" r="148" stroke-opacity=".3"/><path d="M215 295h125l40-63 65 123 67-165 58 140 39-35h135" stroke-width="2"/><path d="M480 72v40m0 336v40M272 280h40m336 0h40" stroke="#B08D57"/></g>`
];
for (let i=0;i<CATEGORIES.length;i++) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#0F2A4A"/>${grid}<g stroke-width="1.2">${motifs[i]}</g><path d="M36 36h27" stroke="#B08D57" stroke-width="2"/><text x="36" y="65" fill="#F7F5F0" font-family="Arial,sans-serif" font-size="12" letter-spacing="3">${escapeHTML(CATEGORIES[i].toLocaleUpperCase('tr-TR'))}</text><path d="M36 505h888" stroke="#F7F5F0" stroke-opacity=".2"/><text x="36" y="526" fill="#F7F5F0" fill-opacity=".65" font-family="Arial,sans-serif" font-size="9" letter-spacing="2">${escapeHTML(SITE_NAME.toLocaleUpperCase('tr-TR'))}</text><rect x="908" y="520" width="16" height="2" fill="#B3122B"/></svg>`;
  await writeFile(resolve(assets, `kapak-${CATEGORY_SLUGS[i]}.svg`),svg);
}
console.log('Logo, simgeler ve yedi kategori kapağı hazır.');
