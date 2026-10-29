export async function onRequestGet({request}) {
  const requestUrl=new URL(request.url), input=requestUrl.searchParams.get('url');
  if(!input)return Response.json({error:'Website-Adresse fehlt.'},{status:400});
  let website;
  try{
    website=new URL(input);
    if(!['http:','https:'].includes(website.protocol)||website.username||website.password||!website.hostname.includes('.')||website.hostname.length>253|| /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1)/i.test(website.hostname))throw Error();
    if(website.port&& !['80','443'].includes(website.port))throw Error();
  }catch{return Response.json({error:'Bitte eine gültige öffentliche Website-Adresse eingeben.'},{status:400})}
  const endpoint='https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&url='+encodeURIComponent(website.href);
  try{
    const ctrl=new AbortController(), timeout=setTimeout(()=>ctrl.abort(),25000);
    let response;
    try{response=await fetch(endpoint,{signal:ctrl.signal,headers:{Accept:'application/json'}})}finally{clearTimeout(timeout)}
    if(!response.ok)return Response.json({error:'Google PageSpeed Insights ist momentan nicht verfügbar (HTTP '+response.status+').'}, {status:503});
    const data=await response.json(),categories=data.lighthouseResult?.categories||{},audits=data.lighthouseResult?.audits||{};
    const getScore=id=>typeof categories[id]?.score==='number'?Math.round(categories[id].score*100):null;
    const measure=id=>audits[id]?.displayValue||'Nicht verfügbar';
    return Response.json({url:website.href,scores:{Performance:getScore('performance'),SEO:getScore('seo'),Barrierefreiheit:getScore('accessibility')},metrics:{'Largest Contentful Paint':measure('largest-contentful-paint'),'Cumulative Layout Shift':measure('cumulative-layout-shift')},source:'Google PageSpeed Insights',method:'mobile'},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://aimpact.ch'}});
  }catch{return Response.json({error:'Die Google-Messung konnte nicht abgeschlossen werden.'},{status:503})}
}