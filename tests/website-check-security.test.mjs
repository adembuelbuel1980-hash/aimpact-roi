import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

function testDB() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE abuse_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)');
  sqlite.exec('CREATE TABLE processed_requests(request_id TEXT PRIMARY KEY,status TEXT NOT NULL,completed_at TEXT)');
  sqlite.exec('CREATE TABLE intake_authorizations(request_id TEXT PRIMARY KEY,payload_hash TEXT NOT NULL,expires_at INTEGER NOT NULL)');
  return { prepare(sql) { return { bind(...args) { return { async first() {return sqlite.prepare(sql).get(...args)||null;},async run() {
    const result = sqlite.prepare(sql).run(...args);
    return { success:true,meta:{changes:Number(result.changes)} };
  } }; } }; },sqlite };
}

async function importSource(path) {
  let code = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  if (path === 'functions/api/website-check.js') {
    const leadCode = await readFile(new URL('../functions/api/website-check-lead.js', import.meta.url), 'utf8');
    code = code.replace('./website-check-lead.js', 'data:text/javascript;base64,' + Buffer.from(leadCode).toString('base64'));
  }
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { onRequestGet } = await importSource('functions/api/website-check.js');
const { reserveLimit, reserveScan } = await importSource('functions/api/website-check-lead.js');
const { onRequestGet: configGet } = await importSource('functions/api/website-check-config.js');

const target = 'https://aimpact-v2-test.pages.dev/api/website-check?url=' + encodeURIComponent('https://example.org');
const req = (token = '') => new Request(target, { headers: { 'CF-Connecting-IP':'198.51.100.20', ...(token ? { 'X-Turnstile-Token': token } : {}) } });
const env = { PAGESPEED_API_KEY: 'dummy-key', TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET_KEY: 'private-test-key' };

test('config endpoint never exposes secret', async () => {
  const response = configGet({ env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req(), env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req('invalid-token'), env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req('some-token'), env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
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
      const response = await onRequestGet({ request: new Request(url), env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
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
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /nicht vollständig/);
  } finally { globalThis.fetch = previous; }
});

test('Turnstile disabled preserves the existing test API path', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.ok(String(url).includes('pagespeedonline/v5/runPagespeed'));
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
      env: { PAGESPEED_API_KEY: 'dummy-key', DB: testDB() }
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});


test('Lighthouse runtime errors are rejected', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes('turnstile/v0/siteverify')) {
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/',
      runtimeError: { code: 'ERRORED_DOCUMENT_REQUEST' },
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.9 },
        'best-practices': { score: 1 },
        seo: { score: 1 }
      },
      audits: {}
    } });
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
    assert.equal(response.status, 502);
  } finally { globalThis.fetch = previous; }
});

test('HTTP failure detected by Lighthouse is not shown as a successful scan', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes('turnstile/v0/siteverify')) {
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/missing',
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.9 },
        'best-practices': { score: 1 },
        seo: { score: 1 }
      },
      audits: { 'http-status-code': { score: 0 } }
    } });
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /HTTP-Statuscode/);
  } finally { globalThis.fetch = previous; }
});

test('upstream Google server errors are handled without exposing internals', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes('turnstile/v0/siteverify')) {
      return Response.json({ success: true, hostname: 'aimpact-v2-test.pages.dev', action: 'website_check' });
    }
    return Response.json({ error: { status: 'INTERNAL' } }, { status: 503 });
  };
  try {
    const response = await onRequestGet({ request: req('valid-token'), env: { ...env, DB: testDB() } });
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.match(data.error, /nicht verfügbar/);
    assert.equal(JSON.stringify(data).includes('INTERNAL'), false);
  } finally { globalThis.fetch = previous; }
});


test('shared client quota stops fourth uncached scan', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  const sharedDB = testDB();
  globalThis.fetch = async url => {
    calls++;
    assert.ok(String(url).includes('pagespeedonline/v5/runPagespeed'));
    return Response.json({ lighthouseResult: {
      finalUrl: 'https://example.org/',
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.9 },
        'best-practices': { score: 1 },
        seo: { score: 1 }
      },
      audits: {}
    } });
  };
  try {
    for (let i = 0; i < 4; i++) {
      const url = 'https://aimpact-v2-test.pages.dev/api/website-check?url=' +
        encodeURIComponent('https://rate-limit-test-' + i + '.example.org');
      const response = await onRequestGet({
        request: new Request(url, { headers: { 'CF-Connecting-IP': '198.51.100.88' } }),
        env: { PAGESPEED_API_KEY: 'dummy-key', DB: sharedDB }
      });
      assert.equal(response.status, i === 3 ? 429 : 200);
      if (i === 3) assert.match((await response.json()).error, /Anfragelimit/);
    }
    assert.equal(calls, 3);
  } finally { globalThis.fetch = previous; }
});

test('atomic shared SQL admits at most fifty concurrent daily reservations', async () => {
  const db=testDB();
  const results=await Promise.all(Array.from({length:100},()=>reserveLimit(db,'scan:global:day',50,86400)));
  assert.equal(results.filter(r=>r.allowed).length,50);
  assert.equal(db.sqlite.prepare('SELECT count FROM abuse_limits').get().count,50);
});

test('independent server instances share the same per-client allowance', async () => {
  const db=testDB();
  const second=await import('data:text/javascript;base64,'+Buffer.from((await readFile(new URL('../functions/api/website-check-lead.js',import.meta.url),'utf8'))+'\n// second server instance').toString('base64'));
  const e={PAGESPEED_API_KEY:'synthetic',DB:db};
  for(let i=0;i<4;i++){
    const reserve=i%2?second.reserveScan:reserveScan;
    assert.equal((await reserve(req(),e)).allowed,i<3);
  }
  const keys=db.sqlite.prepare('SELECT bucket FROM abuse_limits').all().map(r=>r.bucket).join(' ');
  assert(!keys.includes('198.51.100.20'));
  assert(!keys.includes('synthetic'));
});

test('different clients cannot evade the global minute cap',async()=>{
  const db=testDB();
  for(let i=0;i<5;i++){
    const request=new Request(target,{headers:{'CF-Connecting-IP':'198.51.100.'+(100+i)}});
    const result=await reserveScan(request,{PAGESPEED_API_KEY:'synthetic',DB:db});
    assert.equal(result.allowed,i<4);
    if(i===4)assert(result.retryAfter>0&&result.retryAfter<=60);
  }
});

test('new UTC window permits requests without resetting other counters',async()=>{
  const db=testDB(), now=Date.UTC(2026,10,2,7,0,0);
  assert((await reserveLimit(db,'test-window',1,60,now)).allowed);
  assert(!(await reserveLimit(db,'test-window',1,60,now+1000)).allowed);
  assert((await reserveLimit(db,'test-window',1,60,now+60000)).allowed);
});

test('missing or failed quota storage blocks Google and discloses no internal error',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('Google must not be called');};
  try{
    const failed={prepare(){throw new Error('private database failure');}};
    for(const DB of [undefined,failed]){
      const response=await onRequestGet({request:req(),env:{PAGESPEED_API_KEY:'synthetic',DB}});
      assert.equal(response.status,503);
      assert(!JSON.stringify(await response.json()).includes('private database'));
    }
  }finally{globalThis.fetch=old;}
});

test('unknown client identity and failed SQL confirmation are never allowed',async()=>{
  await assert.rejects(reserveScan(new Request(target),{PAGESPEED_API_KEY:'synthetic',DB:testDB()}));
  const broken={prepare(){return{bind(){return{run:async()=>({success:false,meta:{changes:1}})}}}}};
  await assert.rejects(reserveLimit(broken,'test',1,60));
});

const {default:worker}=await importSource('automation/visibility-check-worker.js');
function leadRequest(id=1){return new Request('https://intake.example/',{method:'POST',headers:{Origin:'https://aimpact.ch','Content-Type':'application/json'},body:JSON.stringify({
  request_id:'b1112026-1101-4000-8000-'+String(id).padStart(12,'0'),unternehmen:'Synthetic test',kontaktperson:'Test',email:'test@example.com',score:50,website:'https://example.com/'
})});}

async function authorizedRequest(DB,id=1){const request=leadRequest(id),b=await request.clone().json();const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([b.request_id,b.unternehmen,b.kontaktperson,b.email,b.website,b.score,b.empfehlungen])))).toString('hex');DB.sqlite.prepare('INSERT OR REPLACE INTO intake_authorizations VALUES(?,?,?)').run(b.request_id,hash,Math.floor(Date.now()/1000)+300);return request;}

test('Make intake budget survives independent Worker instances; duplicate does not spend allowance',async()=>{
  const DB=testDB(),e={DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'};
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('accepted');};
  try{
    for(let id=1;id<=4;id++){
      const response=await worker.fetch(await authorizedRequest(DB,id),e);
      assert.equal(response.status,id<=3?202:429);
      if(id===4)assert(response.headers.has('Retry-After'));
    }
    assert.equal(calls,3);
    const duplicate=await worker.fetch(leadRequest(1),e);
    assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).duplicate,true);
    assert.equal(calls,3);
    assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM processed_requests').get().n,3);
  }finally{globalThis.fetch=old;}
});

test('daily and monthly Make budget each stop forwarding before claim or network',async()=>{
  const old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Make must not be called');};
  try{for(const [scope,max]of [['lead:global:day',10],['lead:global:month',20]]){
    const DB=testDB(), now=new Date(),epoch=now.getTime()/1000;
    const end=scope.endsWith('month')?Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)/1000:(Math.floor(epoch/86400)+1)*86400;
    DB.sqlite.prepare('INSERT INTO abuse_limits VALUES(?,?,?)').run(scope+':'+end,max,end);
    const response=await worker.fetch(await authorizedRequest(DB),{DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'});
    assert.equal(response.status,429);
    assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM processed_requests').get().n,0);
  }}finally{globalThis.fetch=old;}
});

test('quota database failure never forwards a lead to Make',async()=>{
  const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('accepted');};
  try{
    const DB=testDB();DB.sqlite.exec('DROP TABLE abuse_limits');
    assert.equal((await worker.fetch(await authorizedRequest(DB),{DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'})).status,503);
    assert.equal(calls,0);
  }finally{globalThis.fetch=old;}
});


 test("direct forged-Origin request cannot reach Make",async()=>{const DB=testDB();const r=await worker.fetch(leadRequest(),{DB,MAKE_WEBHOOK_URL:"https://make.invalid/test"});assert.equal(r.status,403);assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM processed_requests").get().n,0);});

test('signed website intake authorizes exact data end to end; retries never forward twice',async()=>{
 const DB=testDB(), old=globalThis.fetch;
 const {onRequestPost,createAnalysisProof}=await importSource('functions/api/website-check-lead.js');
 const secret='synthetic-bridge-secret';let forwards=0;
 const measured={analyzedUrl:'https://example.com/',measuredAt:new Date().toISOString(),performance:.42,accessibility:.85,bestPractices:1,seo:.91,metrics:{fcp:'1 s',lcp:'2 s',tbt:'30 ms',cls:'0',speedIndex:'1 s'},audits:{}};
 const body={request_id:'c1112026-1101-4000-8000-000000000999',unternehmen:'Bridge test',kontaktperson:'Testperson',email:'test@example.com',analysis_token:await createAnalysisProof(measured,secret),recommendation_ids:[]};
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('aimpact-visibility-api.'))return worker.fetch(new Request(url,options),{DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'});
  forwards++;return new Response('accepted');
 };
 try{
  for(let i=0;i<2;i++){
   const response=await onRequestPost({request:new Request('https://check.aimpact.ch/api/website-check-lead',{method:'POST',body:JSON.stringify(body)}),env:{DB,PAGESPEED_API_KEY:secret}});
   assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
  }
  assert.equal(forwards,1);
  assert.equal(DB.sqlite.prepare('SELECT status FROM processed_requests').get().status,'completed');
 }finally{globalThis.fetch=old;}
});

test('altered or expired authorization cannot reach Make',async()=>{
 const DB=testDB(),old=globalThis.fetch;let forwards=0;
 globalThis.fetch=async()=>{forwards++;return new Response('accepted');};
 try{
  const request=await authorizedRequest(DB);
  DB.sqlite.exec('UPDATE intake_authorizations SET payload_hash=\'altered\'');
  assert.equal((await worker.fetch(request.clone(),{DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'})).status,403);
  await authorizedRequest(DB);DB.sqlite.exec('UPDATE intake_authorizations SET expires_at=0');
  assert.equal((await worker.fetch(request.clone(),{DB,MAKE_WEBHOOK_URL:'https://make.invalid/test'})).status,403);
  assert.equal(forwards,0);
 }finally{globalThis.fetch=old;}
});
