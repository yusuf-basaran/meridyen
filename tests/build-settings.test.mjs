import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteURL, vercelBuildMode } from '../lib/build-settings.mjs';

test('Site adresi açık ayarı korur; Vercel üretim ve önizleme adreslerini ayırır', () => {
  const env = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'meridyen.example', VERCEL_URL: 'preview.vercel.app' };
  assert.equal(resolveSiteURL(env), 'https://meridyen.example');
  assert.equal(resolveSiteURL({ ...env, SITE_URL: 'https://haber.example/' }), 'https://haber.example');
  assert.equal(resolveSiteURL({ ...env, VERCEL_ENV: 'preview' }), 'https://preview.vercel.app');
  assert.equal(resolveSiteURL({ VERCEL: '1', VERCEL_URL: 'preview.vercel.app' }), 'https://preview.vercel.app');
  assert.equal(resolveSiteURL({ VERCEL_URL: 'untrusted.example' }), '');
  assert.equal(resolveSiteURL({}), '');
});

test('Geçersiz site adresi Vercel adresiyle gizlenmez; yalnızca HTTPS kök adresi kabul edilir', () => {
  for (const SITE_URL of ['http://example.com', 'javascript:alert(1)', 'invalid', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?secret=value']) {
    assert.throws(() => resolveSiteURL({ SITE_URL, VERCEL: '1', VERCEL_URL: 'valid.vercel.app' }), /HTTPS/);
  }
});

test('Vercel varsayılanı ücretsiz kaynak akışıdır; hazırlık ve gerçek yayın ayrıca seçilir', () => {
  assert.equal(vercelBuildMode({}), 'sources');
  assert.equal(vercelBuildMode({ MERIDYEN_BUILD_MODE: 'launch' }), 'launch');
  assert.equal(vercelBuildMode({ MERIDYEN_BUILD_MODE: 'production' }), 'production');
  assert.throws(() => vercelBuildMode({ MERIDYEN_BUILD_MODE: 'demo' }));
});
