import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importSource(path) {
  const code = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { onRequestGet } = await importSource('functions/api/website-check.js');
const { onRequestGet: configGet } = await importSource('functions/api/website-check-config.js');

const target = 'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('https://example.org');
const req = (token = '') => new Request(target, { headers: token ? { 'X-Turnstile-Token': token } : {} });
const env = { PAGESPEED_API_KEY: 'dummy-key', TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET_KEY: 'private-test-key' };

test('config endpoint never exposes secret', async () => {
  const response = configGet({ env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.turnstileEnabled, true);
  assert.equal(data.siteKey, env.TURNSTILE_SITE_KEY);
  assert.equal(JSON.stringify(data).includes(env.TURNSTILE_SECRET_KEY), false);
});

test('missing Turnstile token is rejected before Google or cache', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
  try {
    const response = await onRequestGet({ request: req(), env });
    assert.equal(response.status, 403);
  } finally { globalThis.fetch = previous; }
});

test('partial Turnstile setup fails closed', async () => {
  const response = await onRequestGet({ request: req(), env: { ...env, TURNSTILE_SECRET_KEY: '' } });
  assert.equal(response.status, 503);
  const config = configGet({ env: { ...env, TURNSTILE_SECRET_KEY: '' } });
  assert.equal(config.status, 503);
});

test('invalid challenge does not reach Google', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({ success: false }, { status: 200 });
  };
  try {
    const response = await onRequestGet({ request: req('invalid-token'), env });
    assert.equal(response.status, 403);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /turnstile\/v0\/siteverify/);
  } finally { globalThis.fetch = previous; }
});

test('hostname or action mismatch is rejected', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ success: true, hostname: 'attacker.example', action: 'website_check' });
  };
  try {
    const response = await onRequestGet({ request: req('some-token'), env });
    assert.equal(response.status, 403);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

test('valid challenge allows a successful Google Lighthouse response', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes('turnstile/v0/siteverify')) {
      assert.equal(options.method, 'POST');
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/',
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.8 },
        'best-practices': { score: 1 },
        seo: { score: 1 }
      },
      audits: {}
    }});
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.performance, 0.9);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /pagespeedonline\/v5\/runPagespeed/);
  } finally { globalThis.fetch = previous; }
});


test('missing and invalid target URLs are rejected without upstream calls', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected upstream request'); };
  try {
    const invalid = [
      'https://aimpact-v2-test.pages.dev/api/website-check',
      'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('file:///etc/passwd'),
      'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('http://127.0.0.1/'),
      'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('http://[::1]/'),
      'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('https://example.pages.dev/')
    ];
    for (const url of invalid) {
      const response = await onRequestGet({ request: new Request(url), env });
      assert.equal(response.status, 400, url);
    }
  } finally { globalThis.fetch = previous; }
});

test('missing PageSpeed API key returns configuration error', async () => {
  const response = await onRequestGet({
    request: req(),
    env: { ...env, PAGESPEED_API_KEY: '' }
  });
  assert.equal(response.status, 503);
});

test('Google quota exhaustion returns a controlled error', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('turnstile/v0/siteverify')) {
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ error: { status: 'RESOURCE_EXHAUSTED' } }, { status: 429 });
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Limit/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = previous; }
});

test('incomplete Lighthouse scores are not presented as valid analysis', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('turnstile/v0/siteverify')) {
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/',
      categories: { performance: { score: 0.95 }, seo: { score: 1 } },
      audits: {}
    } });
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /nicht vollständig/);
  } finally { globalThis.fetch = previous; }
});

test('Turnstile disabled preserves the existing test API path', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.match(String(url), /pagespeedonline\\/v5\\/runPagespeed/);
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/',
      categories: {
        performance: { score: 0.95 },
        accessibility: { score: 0.9 },
        'best-practices': { score: 1 },
        seo: { score: 1 }
      },
      audits: {}
    } });
  };
  try {
    const response = await onRequestGet({
      request: req(),
      env: { PAGESPEED_API_KEY: 'dummy-key' }
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});
