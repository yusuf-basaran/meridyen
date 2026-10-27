import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLiveSource } from '../lib/live-source-check.mjs';

const now = Date.parse('2026-10-27T18:00:00Z');
const source = {
  sourceId: 'nasa', title: 'NASA invites media to a lunar landing simulator',
  summary: 'NASA invites journalists to a lunar landing simulator.',
  url: 'https://www.nasa.gov/news-release/lunar-landing-simulator/',
  publishedAt: '2026-10-26T17:00:00Z', author: 'NASA'
};
const written = { data: { title: 'NASA simülatör için basını davet etti', summary: 'NASA, basını bir Ay iniş simülatörüne davet etti.' }, provider: 'gemini', model: 'gemini-test', family: 'gemini' };
const review = { data: [{ verdict: 'pass', score: 95, issues: [] }], provider: 'gemini', model: 'gemini-test', family: 'gemini' };

test('live sample calls writer and two reviewers but never publishes', async () => {
  const roles = [];
  const report = await checkLiveSource({ snapshot: { items: [source] }, now, complete: async call => {
    roles.push(call.role);
    return call.role === 'writer' ? written : review;
  } });
  assert.deepEqual(roles.sort(), ['reviewer1', 'reviewer2', 'writer']);
  assert.equal(report.modelResponsesComplete, true);
  assert.equal(report.independent, false);
  assert.equal(report.published, false);
  assert.equal(report.autoPublishUnlocked, false);
  assert.equal(report.status, 'needs_review');
});

test('no model receives Global Voices, expired, or off-domain source content', async () => {
  for (const item of [
    { ...source, sourceId: 'globalvoices', url: 'https://globalvoices.org/2026/10/26/example/' },
    { ...source, publishedAt: '2026-01-01T00:00:00Z' },
    { ...source, url: 'https://example.com/news-release/example/' }
  ]) {
    let calls = 0;
    await assert.rejects(checkLiveSource({ snapshot: { items: [item] }, now, complete: async () => { calls++; } }), /NASA/);
    assert.equal(calls, 0);
  }
});

test('malformed writer output stops before reviewer calls', async () => {
  let calls = 0;
  await assert.rejects(checkLiveSource({ snapshot: { items: [source] }, now, complete: async () => {
    calls++; return { ...written, data: { title: '', summary: 'Eksik' } };
  } }), /geçersiz/);
  assert.equal(calls, 1);
});

test('missing or malformed reviewer response remains incomplete and unpublished', async () => {
  const report = await checkLiveSource({ snapshot: { items: [source] }, now, complete: async call => {
    if (call.role === 'writer') return written;
    if (call.role === 'reviewer1') return review;
    return { ...review, data: [{ verdict: 'pass', score: '95', issues: [] }] };
  } });
  assert.equal(report.modelResponsesComplete, false);
  assert.equal(report.contentPass, false);
  assert.equal(report.published, false);
});
