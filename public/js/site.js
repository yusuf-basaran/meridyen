(() => {
  const fonts = document.getElementById('web-fonts');
  const enableFonts = () => { if (fonts) { fonts.rel = 'stylesheet'; fonts.removeAttribute('as'); } };
  if (document.readyState === 'complete') enableFonts();
  else window.addEventListener('load', () => requestAnimationFrame(enableFonts), { once: true });
  const banner = document.querySelector('.cookie-banner');
  try { if (banner && !localStorage.getItem('meridyen-consent')) banner.hidden = false; } catch { if (banner) banner.hidden = false; }
  document.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => {
    try { localStorage.setItem('meridyen-consent', button.dataset.consent); } catch { /* Depolama kapalı olabilir. */ }
    if (banner) banner.hidden = true;
  }));
  for (const share of document.querySelectorAll('[data-share-title]')) {
    const title = share.dataset.shareTitle;
    const url = share.dataset.shareUrl || location.href;
    share.querySelector('[data-share="telegram"]').href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    share.querySelector('[data-share="bluesky"]').href = `https://bsky.app/intent/compose?text=${encodeURIComponent(title + ' ' + url)}`;
    const copyButton = share.querySelector('[data-copy-link]');
    if (copyButton && navigator.clipboard) {
      copyButton.hidden = false;
      copyButton.addEventListener('click', async () => {
        const status = share.querySelector('.copy-status');
        try { await navigator.clipboard.writeText(url); status.textContent = 'Bağlantı kopyalandı.'; }
        catch { status.textContent = 'Bağlantı kopyalanamadı. Adres çubuğundan kopyalayabilirsiniz.'; }
      });
    }
  }
  if (document.body.dataset.preview !== 'true') {
    const refresh = async () => {
      try {
        const response = await fetch('/api/rates', { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const data = await response.json();
        for (const el of document.querySelectorAll('[data-rate]')) {
          const value = data[el.dataset.rate];
          el.textContent = Number.isFinite(value) && value > 0 ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: el.dataset.rate === 'btc' ? 0 : 2, minimumFractionDigits: el.dataset.rate === 'btc' ? 0 : 2 }).format(value) : '—';
        }
      } catch { /* Kur bilgisi olmadan sayfa kullanılabilir. */ }
    };
    refresh();
    setInterval(refresh, 300000);
  }
})();
