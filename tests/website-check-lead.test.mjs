import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../functions/api/website-check-lead.js',import.meta.url),'utf8');
const {createAnalysisProof,verifyAnalysisProof,onRequestPost}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const secret='synthetic-test-secret-no-real-credential';
const fixture=()=>({analyzedUrl:'https://example.com/',measuredAt:new Date().toISOString(),strategy:'mobile',
  performance:.42,accessibility:.85,bestPractices:1,seo:.91,
  metrics:{fcp:'2.1 s',lcp:'4.3 s',tbt:'210 ms',cls:'0.1',speedIndex:'3.1 s'},
  audits:{'color-contrast':{score:0},'unused-javascript':{score:.5}}});
const payload=async()=>({analysis_token:await createAnalysisProof(fixture(),secret),
 request_id:'b1112026-1101-4000-8000-000000000001',unternehmen:'Technischer Systemtest',
 kontaktperson:'Testperson',email:'test@example.com',recommendation_ids:['color-contrast'],score:100,
 website:'https://forged.example',empfehlungen:'invented findings'});
const request=body=>new Request('https://check.aimpact.ch/api/website-check-lead',{method:'POST',body:JSON.stringify(body)});
test('signed measurement survives verification and does not disclose signing secret',async()=>{
 const proof=await createAnalysisProof(fixture(),secret);
 const data=await verifyAnalysisProof(proof,secret);assert.equal(data.performance,.42);assert(!proof.includes(secret));
});
test('modified measurement and wrong key are rejected',async()=>{
 const token=await createAnalysisProof(fixture(),secret);const [message,signature]=token.split('.');
 const data=JSON.parse(Buffer.from(message,'base64url'));data.performance=1;
 const tampered=Buffer.from(JSON.stringify(data)).toString('base64url')+'.'+signature;
 await assert.rejects(verifyAnalysisProof(tampered,secret));await assert.rejects(verifyAnalysisProof(token,'wrong-key'));
});
test('expired proof is rejected',async()=>{
 const originalNow=Date.now;let proof;
 try{Date.now=()=>originalNow()-8000000;proof=await createAnalysisProof(fixture(),secret);}finally{Date.now=originalNow;}
 await assert.rejects(verifyAnalysisProof(proof,secret));
});
test('lead uses signed URL and scores instead of client claims and keeps status Neu',async()=>{
 const old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);assert.equal(options.headers.Origin,'https://aimpact.ch');return Response.json({ok:true});};
 try {const response=await onRequestPost({request:request(await payload()),env:{PAGESPEED_API_KEY:secret}});
 assert.equal(response.status,200);assert.equal(sent.website,'https://example.com/');assert.equal(sent.score,42);
 assert.equal(sent.status,'Neu');assert.match(sent.empfehlungen,/Technischer Website-Check/);assert.match(sent.empfehlungen,/LCP 4.3 s/);
 assert.match(sent.empfehlungen,/Barrierefreiheit 85/);assert(!sent.empfehlungen.includes('invented'));
 assert(!JSON.stringify(sent).includes('analysis_token'));assert(sent.empfehlungen.length<=600);
 }finally{globalThis.fetch=old;}
});
test('unknown finding, missing or forged proof never reaches intake',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};
 try{const valid=await payload();for(const p of [{...valid,analysis_token:''},{...valid,analysis_token:valid.analysis_token+'x'},
 {...valid,recommendation_ids:['document-title']}]){
  const response=await onRequestPost({request:request(p),env:{PAGESPEED_API_KEY:secret}});assert.equal(response.status,422);}
 assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('upstream rejection or uncertainty is not shown as success',async()=>{
 const old=globalThis.fetch;
 try{for(const result of [{ok:false},{ok:true,pending:true}]){
 globalThis.fetch=async()=>Response.json(result);const response=await onRequestPost({request:request(await payload()),env:{PAGESPEED_API_KEY:secret}});assert.equal(response.status,502);
 }}finally{globalThis.fetch=old;}
});
