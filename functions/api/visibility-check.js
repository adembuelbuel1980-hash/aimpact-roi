export async function onRequestGet({ request, env }) {
  const input = new URL(request.url).searchParams.get('url');
  if (!input) return Response.json({ error: 'Website-Adresse fehlt.' }, { status: 400 });
  let website;
  try {
    website = new URL(input);
    const host = website.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(website.protocol) ||
        website.username || website.password || website.port ||
        !host.includes('.') || host.length > 253 ||
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1)/i.test(host) ||
        host.endsWith('.local') || host.endsWith('.internal')) throw Error();
  } catch {
    return Response.json({ error: 'Bitte eine gültige öffentliche Website-Adresse eingeben.' }, { status: 400 });
  }

  // A configured key uses the Google Cloud project's own quota.
  // Store it as a Cloudflare Pages secret named PAGESPEED_API_KEY.
  const key = env?.PAGESPEED_API_KEY;
  if (!key) return Response.json({
    error: 'Die automatische Messung ist noch nicht freigeschaltet. Ein PageSpeed-API-Schlüssel muss in Cloudflare konfiguriert werden.',
    code: 'API_KEY_NOT_CONFIGURED'
  }, { status: 503 });

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('strategy', 'mobile');
  for (const c of ['PERFORMANCE', 'SEO', 'ACCESSIBILITY']) endpoint.searchParams.append('category', c);
  endpoint.searchParams.set('url', website.href);
  endpoint.searchParams.set('key', key);

  // Cache only successful results for 24h, without storing the API key in the cache URL.
  const cacheKey = new Request('https://aimpact-cache.invalid/psi-v22?url=' + encodeURIComponent(website.href), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(endpoint.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch {
    return Response.json({ error: 'Google PageSpeed Insights konnte nicht erreicht werden.' }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    return Response.json({ error: 'Google hat das API-Limit erreicht. Die Messung ist zurzeit nicht möglich; bitte später erneut versuchen.', code: 'GOOGLE_RATE_LIMIT' }, { status: 503 });
  }
  if (!response.ok) {
    return Response.json({ error: 'Google konnte diese Website momentan nicht analysieren (HTTP ' + response.status + ').' }, { status: 503 });
  }

  let data;
  try { data = await response.json(); }
  catch { return Response.json({ error: 'Google hat eine ungültige Antwort geliefert.' }, { status: 503 }); }

  const categories = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};
  const score = id => typeof categories[id]?.score === 'number' ? Math.round(categories[id].score * 100) : null;
  const metric = id => audits[id]?.displayValue || 'Nicht verfügbar';
  // Only include observed Lighthouse audit signals, never invented local rankings.
  const checks = [
    ['render-blocking-resources','Renderblockierende Ressourcen','Nicht benötigte CSS-/JavaScript-Ressourcen reduzieren.'],
    ['unused-javascript','Ungenutztes JavaScript','Nicht benötigte Skripte entfernen oder später laden.'],
    ['modern-image-formats','Bildformate','Geeignete moderne Bildformate prüfen.'],
    ['uses-optimized-images','Bildoptimierung','Bilddateien komprimieren und passend dimensionieren.'],
    ['uses-responsive-images','Responsive Bilder','Bildgrössen für Mobilgeräte anpassen.'],
    ['image-alt','Bildbeschreibungen','Aussagekräftige Alternativtexte ergänzen.'],
    ['document-title','Seitentitel','Einen klaren, eindeutigen Seitentitel prüfen.'],
    ['meta-description','Meta-Beschreibung','Eine aussagekräftige Meta-Beschreibung hinterlegen.'],
    ['crawlable-anchors','Crawlbare Links','Links als echte, zugängliche Verweise bereitstellen.'],
    ['color-contrast','Textkontrast','Kontraste für bessere Lesbarkeit korrigieren.'],
    ['label','Formularbeschriftungen','Eingabefelder eindeutig beschriften.'],
    ['tap-targets','Klickflächen','Klickflächen ausreichend gross und mit Abstand gestalten.']
  ];
  const findings = checks.flatMap(([id,title,recommendation])=>{
    const a=audits[id];
    if (!a || typeof a.score !== 'number' || a.score >= 0.9 || a.scoreDisplayMode === 'notApplicable') return [];
    return [{ title, recommendation, score: Math.round(a.score*100), detail: String(a.displayValue||'').slice(0,120) }];
  }).sort((a,b)=>a.score-b.score).slice(0,3);
  const output = Response.json({
    url: website.href,
    scores: { Performance: score('performance'), SEO: score('seo'), Barrierefreiheit: score('accessibility') },
    metrics: {
      'Largest Contentful Paint': metric('largest-contentful-paint'),
      'Cumulative Layout Shift': metric('cumulative-layout-shift')
    },
    source: 'Google PageSpeed Insights',
    method: 'mobile',
    findings
  }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=86400' } });
  await cache.put(cacheKey, output.clone());
  return output;
}