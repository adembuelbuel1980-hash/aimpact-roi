// Server-signed measurement proof. The API key never leaves Cloudflare.
const encoder = new TextEncoder();
// Shared D1 counters: every reservation is a single atomic conditional write.
// Limits are fixed UTC windows. Failed upstream calls still consume a slot.
export const LIMIT_SCHEMA = `CREATE TABLE IF NOT EXISTS abuse_limits (
  bucket TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count >= 1), expires_at INTEGER NOT NULL
)`;
export const RESERVE_LIMIT = `INSERT INTO abuse_limits(bucket,count,expires_at) VALUES (?,1,?)
ON CONFLICT(bucket) DO UPDATE SET count=abuse_limits.count+1 WHERE abuse_limits.count < ?`;
export async function reserveLimit(db, scope, maximum, seconds, now = Date.now()) {
  if (!db) throw new Error('Shared quota storage unavailable');
  const end = (Math.floor(now / 1000 / seconds) + 1) * seconds;
  const bucket = scope + ':' + end;
  const result = await db.prepare(RESERVE_LIMIT).bind(bucket,end,maximum).run();
  if (result.success !== true || ![0,1].includes(result.meta?.changes)) throw new Error('Shared quota write failed');
  return { allowed: result.meta.changes === 1, retryAfter: Math.max(1,end-Math.floor(now/1000)) };
}
export async function reserveScan(request, env) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !env.PAGESPEED_API_KEY) throw new Error('Trusted client identity unavailable');
  // Daily, secret-salted hash; raw IP addresses are never stored in D1.
  const day = new Date().toISOString().slice(0,10);
  const digest = await crypto.subtle.digest('SHA-256',encoder.encode(env.PAGESPEED_API_KEY+'\0scan-client\0'+day+'\0'+ip));
  const client = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  for (const [scope,max,seconds] of [['scan:global:day',50,86400],['scan:global:minute',4,60],['scan:client:'+client,3,600]]) {
    const result = await reserveLimit(env.DB,scope,max,seconds);
    if (!result.allowed) return result;
  }
  await env.DB.prepare('DELETE FROM abuse_limits WHERE bucket IN (SELECT bucket FROM abuse_limits WHERE expires_at < ? LIMIT 100)').bind(Math.floor(Date.now()/1000)-172800).run();
  return { allowed:true };
}
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const scoreKeys = ['performance','accessibility','bestPractices','seo'];
const metricKeys = ['fcp','lcp','tbt','cls','speedIndex'];
async function signingKey(secret) {
  if(!secret) throw new Error('Missing configuration');
  const seed=await crypto.subtle.digest('SHA-256',encoder.encode('Aimpact website measurement proof v1\0'+secret));
  return crypto.subtle.importKey('raw',seed,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function createAnalysisProof(data, secret) {
  const value={
    v:1,exp:Math.floor(Date.now()/1000)+7200,
    analyzedUrl:data.analyzedUrl,measuredAt:data.measuredAt,strategy:'mobile',
    ...Object.fromEntries(scoreKeys.map(k=>[k,data[k]])),
    metrics:Object.fromEntries(metricKeys.map(k=>[k,String(data.metrics?.[k]??'Nicht verfügbar').slice(0,80)])),
    audits:Object.fromEntries(Object.entries(data.audits||{}).filter(([id,a])=>id.length<=100&&typeof a.score==='number'&&a.score<0.9).slice(0,100).map(([id,a])=>[id,a.score]))
  };
  const encoded=b64(encoder.encode(JSON.stringify(value)));
  const signature=await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(encoded));
  return encoded+'.'+b64(new Uint8Array(signature));
}
export async function verifyAnalysisProof(token, secret) {
  if(typeof token!=='string'||token.length>20000) throw new Error('Invalid proof');
  const parts=token.split('.');
  if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Invalid proof');
  const valid=await crypto.subtle.verify('HMAC',await signingKey(secret),unb64(parts[1]),encoder.encode(parts[0]));
  if(!valid) throw new Error('Invalid signature');
  const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
  const now=Math.floor(Date.now()/1000);
  if(data.v!==1||!Number.isFinite(data.exp)||data.exp<now||data.exp>now+7200||
    !scoreKeys.every(k=>typeof data[k]==='number'&&Number.isFinite(data[k])&&data[k]>=0&&data[k]<=1)||
    !/^https?:\/\//.test(data.analyzedUrl)||!Number.isFinite(Date.parse(data.measuredAt)))
    throw new Error('Invalid or expired measurement');
  return data;
}
const auditTitles = {
  'color-contrast':'Textkontrast verbessern',
  'label-content-name-mismatch':'Beschriftungen für Screenreader verbessern',
  'link-name':'Links verständlich beschriften',
  'heading-order':'Überschriftenstruktur verbessern',
  'label':'Formularfelder korrekt beschriften',
  'unused-javascript':'Nicht benötigtes JavaScript reduzieren',
  'unused-css-rules':'Nicht benötigtes CSS reduzieren',
  'cache-insight':'Browser-Caching verbessern',
  'uses-long-cache-ttl':'Browser-Caching verbessern',
  'render-blocking-resources':'Render-blockierende Ressourcen reduzieren',
  'render-blocking-insight':'Render-blockierende Ressourcen reduzieren',
  'largest-contentful-paint':'Ladezeit des grössten sichtbaren Elements verbessern',
  'lcp-breakdown-insight':'LCP-Ladezeit analysieren',
  'lcp-discovery-insight':'LCP-Bild früher laden',
  'image-delivery-insight':'Bilder schneller laden',
  'modern-image-formats':'Moderne Bildformate verwenden',
  'uses-optimized-images':'Bilder komprimieren',
  'uses-responsive-images':'Passende Bildgrössen verwenden',
  'forced-reflow-insight':'Unnötige Layout-Berechnungen reduzieren',
  'forced-reflow':'Unnötige Layout-Berechnungen reduzieren',
  'network-dependency-tree-insight':'Ladeabhängigkeiten reduzieren',
  'max-potential-fid':'JavaScript-Reaktionszeit verbessern',
  'font-display-insight':'Schriftarten schneller anzeigen',
  'font-display':'Schriftarten schneller anzeigen',
  'document-title':'Seitentitel ergänzen',
  'meta-description':'Meta-Beschreibung ergänzen',
  'image-alt':'Alternativtexte für Bilder ergänzen',
  'is-crawlable':'Indexierungsanweisungen prüfen',
  'uses-https':'HTTPS aktivieren',
  'viewport':'Viewport-Meta-Tag prüfen',
  'errors-in-console':'JavaScript-Fehler beheben',
'doctype':'HTML-Doctype ergänzen',
'html-has-lang':'Sprache der Website festlegen',
'charset':'Zeichenkodierung festlegen',
'http-status-code':'HTTP-Statuscode überprüfen',
'landmark-one-main':'Hauptinhalt der Website kennzeichnen',
};
export function summarizeAnalysis(data, selectedIds=[]) {
  const ids=[...new Set(Array.isArray(selectedIds)?selectedIds:[])].slice(0,3);
  if(ids.some(id=>typeof id!=='string'||!auditTitles[id]||typeof data.audits?.[id]!=='number'||data.audits[id]>=0.9))
    throw new Error('Invalid finding');
  const n=k=>Math.round(data[k]*100);
  const m=data.metrics||{};
  const findings=ids.map(id=>auditTitles[id]).join('; ')||'Keine priorisierte Massnahme übermittelt';
  return ('Technischer Website-Check | Google Lighthouse, mobile | Messzeit: '+data.measuredAt+
    ' | Performance '+n('performance')+'/100; Barrierefreiheit '+n('accessibility')+'/100; Best Practices '+n('bestPractices')+'/100; technisches SEO '+n('seo')+'/100'+
    ' | FCP '+m.fcp+'; LCP '+m.lcp+'; TBT '+m.tbt+'; CLS '+m.cls+'; Speed Index '+m.speedIndex+
    ' | Befunde: '+findings+' | Keine Ranking- oder KI-Sichtbarkeitsmessung.').slice(0,600);
}
export async function onRequestPost({request,env}) {
  const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
  if(!env.PAGESPEED_API_KEY) return reply({error:'Messdatenprüfung nicht konfiguriert.'},503);
  let body,data;
  try {
    const text=await request.text();
    if(text.length>24000) return reply({error:'Anfrage zu gross.'},413);
    body=JSON.parse(text);
    data=await verifyAnalysisProof(body.analysis_token,env.PAGESPEED_API_KEY);
  } catch {return reply({error:'Messdaten fehlen, wurden verändert oder sind abgelaufen. Bitte Website erneut prüfen.'},422);}
  const clean=(value,max)=>String(value??'').trim().slice(0,max);
  const requestId=clean(body.request_id,100),email=clean(body.email,254);
  const company=clean(body.unternehmen,160)||(body.request_type==='maps_check'?'Website: '+new URL(data.analyzedUrl).hostname:'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)||
    !company||!clean(body.kontaktperson,120)||!/^\S+@\S+\.\S+$/.test(email))
    return reply({error:'Bitte Name, Unternehmen und gültige E-Mail-Adresse angeben.'},422);
  let summary;
  try {summary=summarizeAnalysis(data,body.recommendation_ids);if(body.request_type==='maps_check') summary=summary.slice(0,540)+' | Anfrage: persönlicher Maps-Check.';} catch {return reply({error:'Prüfbefunde stimmen nicht mit der Messung überein. Bitte Website erneut prüfen.'},422);}
  try {
    const authorizedPayload={request_id:requestId,unternehmen:company,kontaktperson:clean(body.kontaktperson,120),email,website:data.analyzedUrl,score:Math.round(data.performance*100),empfehlungen:summary};
    const digest=await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(Object.values(authorizedPayload))));
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(!env.DB) return reply({error:'Übermittlung momentan nicht verfügbar.'},503);
    const authorization=await env.DB.prepare('INSERT OR IGNORE INTO intake_authorizations(request_id,payload_hash,expires_at) VALUES(?,?,?)').bind(requestId,hash,Math.floor(Date.now()/1000)+300).run();
    if(authorization.success!==true) return reply({error:'Übermittlung momentan nicht verfügbar.'},503);
    await env.DB.prepare('DELETE FROM intake_authorizations WHERE request_id IN (SELECT request_id FROM intake_authorizations WHERE expires_at < ? LIMIT 100)').bind(Math.floor(Date.now()/1000)-172800).run();
    const response=await fetch('https://aimpact-visibility-api.adembuelbuel1980.workers.dev/',{
      method:'POST',headers:{'Content-Type':'application/json','Origin':'https://aimpact.ch'},
      body:JSON.stringify({request_id:requestId,unternehmen:company,
        kontaktperson:clean(body.kontaktperson,120),email,website:data.analyzedUrl,
        score:Math.round(data.performance*100),empfehlungen:summary,status:'Neu',
        quelle:'Technischer Website-Check – Google Lighthouse'}),
      signal:AbortSignal.timeout(15000)
    });
    const result=await response.json().catch(()=>({}));
    if(response.status===429) return reply({error:'Das Anfragelimit ist erreicht. Bitte später erneut versuchen.'},429,{
      'Retry-After':String(Math.max(1,Math.min(2678400,Number(response.headers.get('Retry-After'))||60)))
    });
    if(!response.ok||result.ok!==true||result.pending)
      return reply({error:'Die Übermittlung wurde noch nicht bestätigt. Bitte erneut versuchen.'},502);
    return reply({ok:true,duplicate:result.duplicate===true});
  } catch {return reply({error:'Die Übermittlung ist momentan nicht bestätigt. Bitte erneut versuchen.'},503);}
}

