import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../website-check.html',import.meta.url),'utf8');
const code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
function harness(){
 const nodes={},calls=[];let fail=false;
 const node=id=>nodes[id]??={id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,handlers:{},addEventListener(k,f){this.handlers[k]=f},reset(){}};
 const analysis={analyzedUrl:'https://example.com/',measuredAt:'2026-11-02T06:00:00Z',strategy:'mobile',performance:.42,accessibility:.85,bestPractices:1,seo:.91,metrics:{fcp:'2.1 s',lcp:'4.3 s',tbt:'210 ms',cls:'0.1',speedIndex:'3.1 s'},audits:{'color-contrast':{score:0}},checks:[],analysisToken:'synthetic-signed-result'};
 const scope={console,URL,AbortController,AbortSignal,setTimeout,clearTimeout,Intl,Date,Math,Map,Set,String,Number,Object,Array,crypto:{randomUUID:()=> 'c1112026-1102-4000-8000-000000000001'},window:{},document:{getElementById:node},FormData:class{entries(){return Object.entries({name:'Testperson',email:'test@example.com'})}},fetch:async(url,options)=>{calls.push({url,options});if(url.includes('config'))return {ok:true,json:async()=>({turnstileEnabled:false})};if(url.includes('/api/website-check?'))return {ok:!fail,status:fail?502:200,json:async()=>fail?{error:'Google unavailable'}:analysis};if(url==='/api/website-check-lead')return {ok:true,json:async()=>({ok:true})};return {ok:false};}};
 vm.createContext(scope);vm.runInContext(code,scope);
 const submit=id=>node(id).handlers.submit({preventDefault(){},currentTarget:node(id)});
 return {node,nodes,calls,submit,analysis,setFail:()=>{fail=true}};
}
test('domain input triggers a real analysis request and renders supplied technical scores',async()=>{
 const h=harness();await new Promise(setImmediate);h.node('website-url').value='example.com';await h.submit('check-form');
 assert(h.calls.some(c=>c.url==='/api/website-check?url=https%3A%2F%2Fexample.com%2F'));
 assert(h.node('scores').innerHTML.includes('42/100'));assert(h.node('scores').innerHTML.includes('85/100'));
 assert(h.node('metrics').innerHTML.includes('4.3 s'));assert.equal(h.node('status').textContent,'Analyse abgeschlossen.');
});
test('lead carries signed analysis and observed findings; repeated submit does not duplicate intake',async()=>{
 const h=harness();await new Promise(setImmediate);h.node('website-url').value='https://example.com';await h.submit('check-form');await h.submit('lead-form');await h.submit('lead-form');
 const calls=h.calls.filter(c=>c.url==='/api/website-check-lead');assert.equal(calls.length,1);
 const body=JSON.parse(calls[0].options.body);assert.equal(body.analysis_token,'synthetic-signed-result');assert.equal(body.score,42);assert.deepEqual(body.recommendation_ids,['color-contrast']);assert.equal(h.node('lead-button').disabled,true);
});
test('failed new scan clears old analysis and cannot submit stale results',async()=>{
 const h=harness();await new Promise(setImmediate);h.node('website-url').value='example.com';await h.submit('check-form');h.setFail();await h.submit('check-form');await h.submit('lead-form');
 assert.equal(h.node('results').hidden,true);assert.equal(h.calls.filter(c=>c.url==='/api/website-check-lead').length,0);assert.match(h.node('lead-status').textContent,/zuerst erneut prüfen/);
});

test('good technical results invite a separate Maps check without claiming rankings',async()=>{
 const h=harness();await new Promise(setImmediate);
 Object.assign(h.analysis,{performance:1,accessibility:.95,bestPractices:1,seo:1});
 h.node('website-url').value='example.com';await h.submit('check-form');
 assert.match(h.node('maps-bridge-heading').textContent,/Gute Technikwerte/);
 assert.match(h.node('maps-bridge-copy').textContent,/kein Nachweis/);
 assert.equal(h.calls.filter(c=>c.url==='/api/website-check-lead').length,0);
});
test('weaker results keep technical improvements separate from Maps visibility',async()=>{
 const h=harness();await new Promise(setImmediate);h.node('website-url').value='example.com';await h.submit('check-form');
 assert.match(h.node('maps-bridge-heading').textContent,/Technik verbessern/);
 assert.match(h.node('maps-bridge-copy').textContent,/separat/);
});
test('missing technical score never produces a good-results invitation',async()=>{
 const h=harness();await new Promise(setImmediate);h.analysis.seo=null;
 h.node('website-url').value='example.com';await h.submit('check-form');
 assert.match(h.node('maps-bridge-copy').textContent,/Werte fehlen/);
 assert.doesNotMatch(h.node('maps-bridge-heading').textContent,/Gute Technikwerte/);
});

test('single Maps form sends intent and signed website without requiring a company field',async()=>{
 const h=harness();await new Promise(setImmediate);h.node('website-url').value='example.com';
 await h.submit('check-form');await h.submit('lead-form');
 const body=JSON.parse(h.calls.find(c=>c.url==='/api/website-check-lead').options.body);
 assert.equal(body.request_type,'maps_check');assert.equal(body.unternehmen,undefined);
 assert.equal(body.website,'https://example.com/');
 assert.equal((html.match(/id="lead-form"/g)||[]).length,1);
 assert(!html.includes('id="lead-section"'));assert(!html.includes('id="lead-company"'));
 assert(html.indexOf('id="lead-form"')>html.indexOf('id="maps-bridge"'));
 assert(html.indexOf('id="lead-form"')<html.indexOf('<h2>Messwerte</h2>'));
});
