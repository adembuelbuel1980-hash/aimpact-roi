/**
 * Aimpact Visibility Check -> Make proxy (Cloudflare Worker)
 * Required secret: MAKE_WEBHOOK_URL (set with wrangler secret put MAKE_WEBHOOK_URL).
 * Optional ALLOWED_ORIGIN defaults to https://aimpact.ch.
 * Set Cloudflare rate limiting / Turnstile before production use.
 */
const headersFor = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Vary':'Origin',
  'Content-Type':'application/json; charset=utf-8'
});
const json = (obj,status,origin)=>new Response(JSON.stringify(obj),{status,headers:headersFor(origin)});
export default {
  async fetch(request,env){
    const origin=env.ALLOWED_ORIGIN || 'https://aimpact.ch';
    if(request.headers.get('Origin')!==origin) return new Response('Forbidden',{status:403});
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:headersFor(origin)});
    if(request.method!=='POST') return json({error:'Method not allowed'},405,origin);
    if(!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'Invalid type'},415,origin);
    if(Number(request.headers.get('Content-Length')||0)>12000) return json({error:'Payload too large'},413,origin);
    if(!env.MAKE_WEBHOOK_URL) return json({error:'Not configured'},503,origin);
    let body;
    try {body=await request.json()} catch {return json({error:'Invalid JSON'},400,origin)}
    if(!body || typeof body!=='object') return json({error:'Invalid payload'},400,origin);
    const clean=(x,n=200)=>String(x??'').trim().slice(0,n);
    const score=Number(body.score);
    const email=clean(body.email,254);
    if(!clean(body.unternehmen)||!clean(body.kontaktperson)||!/^\S+@\S+\.\S+$/.test(email)||!Number.isFinite(score)||score<0||score>100)
      return json({error:'Invalid lead'},422,origin);
    const payload={
      datum:new Date().toISOString().slice(0,10),
      unternehmen:clean(body.unternehmen), kontaktperson:clean(body.kontaktperson),
      email,website:clean(body.website,500),
      score:Math.round(score),
      empfehlungen:clean(body.empfehlungen,600),
      status:'Neu',
      telefon:clean(body.telefon,40),
      quelle:'Visibility Check – Selbsteinschätzung',
      einzelwerte:Object.fromEntries(['google','maps','website','content','ai','conversion'].map(k=>[k,Math.max(0,Math.min(100,Number(body.einzelwerte?.[k])||0))]))
    };
    try {
      const response=await fetch(env.MAKE_WEBHOOK_URL,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
        signal:AbortSignal.timeout(8000)});
      if(!response.ok) return json({error:'Automation unavailable'},502,origin);
      return json({ok:true},202,origin);
    } catch {return json({error:'Automation unavailable'},502,origin)}
  }
};
