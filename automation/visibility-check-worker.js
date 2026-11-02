/**
 * Aimpact Visibility Check -> Make proxy (Cloudflare Worker)
 * Required secret: MAKE_WEBHOOK_URL (set with wrangler secret put MAKE_WEBHOOK_URL).
 * Optional ALLOWED_ORIGIN defaults to https://aimpact.ch.
 * Shared D1 cost limits protect forwarding independently of spoofable Origin.
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
    // A new UUID is created once per browser form submission. Reject legacy
    // payloads without an ID once this version is intentionally deployed.
    const requestId=clean(body.request_id,100);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
      return json({error:'Invalid request_id'},422,origin);
    if(!env.DB) return json({error:'Request registry not configured'},503,origin);
    const payload={
      request_id:requestId,
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
    // Completed retries remain successful even when the current budget is full.
    // No row is claimed until budget is reserved, so a 429 can be retried later.
    try {
      const previous=await env.DB.prepare('SELECT status FROM processed_requests WHERE request_id = ?').bind(requestId).first();
      if(previous?.status==='completed') return json({ok:true,duplicate:true},200,origin);
      if(previous?.status==='pending') return json({ok:true,duplicate:true,pending:true},202,origin);
      if(previous?.status==='failed') return json({error:'Previously failed; manual review required',duplicate:true},409,origin);
      const now=new Date(), epoch=Math.floor(now.getTime()/1000);
      const monthEnd=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)/1000;
      const limits=[['lead:global:month',20,monthEnd],['lead:global:day',10,(Math.floor(epoch/86400)+1)*86400],['lead:global:minute',3,(Math.floor(epoch/60)+1)*60]];
      for(const [scope,maximum,end] of limits){
        const reservation=await env.DB.prepare(`INSERT INTO abuse_limits(bucket,count,expires_at) VALUES (?,1,?)
ON CONFLICT(bucket) DO UPDATE SET count=abuse_limits.count+1 WHERE abuse_limits.count < ?`).bind(scope+':'+end,end,maximum).run();
        if(reservation.success!==true||![0,1].includes(reservation.meta?.changes)) throw new Error('Quota confirmation failed');
        if(reservation.meta.changes===0) return new Response(JSON.stringify({error:'Das Anfragelimit ist erreicht. Bitte später erneut versuchen.'}),{status:429,headers:{...headersFor(origin),'Retry-After':String(Math.max(1,Number(end)-epoch))}});
      }
    } catch { return json({error:'Anfragen momentan nicht verfügbar. Bitte später erneut versuchen.'},503,origin); }
    // The primary key makes claiming an ID atomic even for concurrent requests.
    // A repeat submission must NEVER call Make a second time.
    let claim;
    try {
      claim=await env.DB.prepare(
        "INSERT OR IGNORE INTO processed_requests (request_id, status) VALUES (?, 'pending')"
      ).bind(requestId).run();
    } catch {
      return json({error:'Request registry unavailable'},503,origin);
    }
    if(claim.success !== true) return json({error:'Request registry unavailable'},503,origin);
    if(claim.meta?.changes === 0) {
      let previous;
      try {
        previous=await env.DB.prepare(
          'SELECT status FROM processed_requests WHERE request_id = ?'
        ).bind(requestId).first();
      } catch {
        return json({error:'Request registry unavailable'},503,origin);
      }
      if(previous?.status === 'completed') return json({ok:true,duplicate:true},200,origin);
      if(previous?.status === 'failed') return json({error:'Previously failed; manual review required',duplicate:true},409,origin);
      return json({ok:true,duplicate:true,pending:true},202,origin);
    }
    if(claim.meta?.changes !== 1) return json({error:'Request registry unavailable'},503,origin);

    // A failed/uncertain delivery is held for MANUAL review. Do not
    // automatically retry: Make may have accepted the request before timeout.
    const markFailed=async()=>{
      try {
        await env.DB.prepare(
          "UPDATE processed_requests SET status = 'failed' WHERE request_id = ? AND status = 'pending'"
        ).bind(requestId).run();
      } catch { /* pending lock remains; no automatic duplicate delivery */ }
    };
    let response;
    try {
      response=await fetch(env.MAKE_WEBHOOK_URL,{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
    } catch {
      await markFailed();
      return json({error:'Delivery not confirmed; manual review required'},502,origin);
    }
    if(!response.ok) {
      await markFailed();
      return json({error:'Automation rejected request; manual review required'},502,origin);
    }
    // Make's HTTP acceptance does not prove a Google Sheets row was written.
    try {
      const recorded=await env.DB.prepare(
        "UPDATE processed_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE request_id = ? AND status = 'pending'"
      ).bind(requestId).run();
      if(recorded.success !== true || recorded.meta?.changes !== 1) throw new Error('status update failed');
    } catch {
      return json({error:'Forwarded, but status confirmation failed; manual review required'},502,origin);
    }
    return json({ok:true},202,origin);
  }
};
