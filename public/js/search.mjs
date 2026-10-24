import MiniSearch from 'minisearch';
const form = document.querySelector('.search-form');
const input = form.querySelector('input');
const results = document.querySelector('#search-results');
const status = document.querySelector('#search-status');
const initialContent = results.innerHTML;
let index;
const categorySlugs = { 'Gündem':'gundem', 'Ekonomi':'ekonomi', 'Dünya':'dunya', 'Spor':'spor', 'Teknoloji':'teknoloji', 'Bilim':'bilim', 'Sağlık':'saglik' };
function render(rows) {
  results.replaceChildren();
  for (const row of rows) {
    const article = document.createElement('article'); article.className = 'news-card';
    const img = document.createElement('img'); img.src = `/assets/kapak-${categorySlugs[row.category] || 'gundem'}.svg`; img.width = 960; img.height = 540; img.alt = ''; img.loading = 'lazy';
    const copy = document.createElement('div'); copy.className = 'card-copy';
    const tag = document.createElement('span'); tag.className = 'eyebrow'; tag.textContent = row.category;
    const heading = document.createElement('h2'); const link = document.createElement('a'); link.href = row.path; link.textContent = row.title; heading.append(link);
    const summary = document.createElement('p'); summary.className = 'search-result-summary'; summary.textContent = row.summary;
    copy.append(tag, heading, summary); article.append(img, copy); results.append(article);
  }
}
async function search(query) {
  if (!query.trim()) { results.innerHTML = initialContent; status.textContent = 'Son haberler'; return; }
  status.textContent = 'Aranıyor…';
  try {
    if (!index) {
      const response = await fetch('/search-index.json');
      if (!response.ok) throw new Error();
      const entries = await response.json();
      index = new MiniSearch({ fields: ['title','summary'], storeFields: ['title','summary','category','path'], processTerm: term => term.toLocaleLowerCase('tr-TR') });
      index.addAll(entries);
    }
    const rows = index.search(query, { prefix: true, fuzzy: .15, combineWith: 'AND', boost: { title: 2 } }).slice(0, 60);
    render(rows); status.textContent = rows.length ? `${rows.length} haber bulundu.` : 'Aramanızla eşleşen haber bulunamadı.';
  } catch { status.textContent = 'Arama şu anda kullanılamıyor. Lütfen yeniden deneyin.'; }
}
form.addEventListener('submit', event => { event.preventDefault(); const q = input.value.trim().slice(0, 200); const url = new URL(location.href); q ? url.searchParams.set('q', q) : url.searchParams.delete('q'); history.replaceState(null, '', url); search(q); });
input.value = (new URLSearchParams(location.search).get('q') || '').slice(0, 200);
if (input.value) search(input.value);
