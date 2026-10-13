
// Reuse recent measurements to reduce Google quota consumption.
// Cloudflare Cache API is best-effort and local to the serving data center.
// It is NOT a per-user or globally distributed rate limiter.
const inflight = new Map();
const CACHE_SECONDS = 600;
const CACHE_PATH = "/__internal_cache/website-check-v3?url=";

// Additional best-effort per-client throttling within a single Worker isolate.
// Cloudflare runs many isolates globally, so this is NOT a distributed rate limit.
const clientWindows = new Map();
const CLIENT_WINDOW_MS = 10 * 60 * 1000;
const CLIENT_MAX_SCANS = 3;
const MAX_TRACKED_CLIENTS = 1024;

function allowClientScan(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  // No trusted Cloudflare IP header in local tests; do not trust user-supplied
  // forwarding headers as an identity substitute.
  if (!ip) return true;
  const now = Date.now();
  const existing = clientWindows.get(ip);
  if (existing && now - existing.startedAt < CLIENT_WINDOW_MS) {
    if (existing.count >= CLIENT_MAX_SCANS) return false;
    existing.count += 1;
    return true;
  }
  if (clientWindows.size >= MAX_TRACKED_CLIENTS) {
    for (const [key, value] of clientWindows) {
      if (now - value.startedAt >= CLIENT_WINDOW_MS) clientWindows.delete(key);
    }
    if (clientWindows.size >= MAX_TRACKED_CLIENTS) {
      clientWindows.delete(clientWindows.keys().next().value);
    }
  }
  clientWindows.set(ip, { startedAt: now, count: 1 });
  return true;
}

export async function onRequestGet({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  try {
    const input = new URL(request.url).searchParams.get("url");

    if (!input) {
      return respond({ error: "Website-Adresse fehlt." }, 400);
    }
    if (input.length > 2048) {
      return respond({ error: "Die Website-Adresse ist zu lang." }, 400);
    }

    let target;
    try {
      target = new URL(input);
    } catch {
      return respond({ error: "Ungültige Website-Adresse." }, 400);
    }

    if (!["https:", "http:"].includes(target.protocol) ||
        target.username || target.password ||
        !target.hostname.includes(".")) {
      return respond({ error: "Ungültige Website-Adresse." }, 400);
    }

    const hostname = target.hostname.toLowerCase();
    // Literal IP-Adressen (IPv4, IPv6 und alternative Zahlenschreibweisen)
    // nicht als zu prüfende öffentliche Website zulassen.
    const ipLiteral = hostname.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    if (ipLiteral ||

      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid") ||
      hostname.endsWith(".example") ||
      hostname.endsWith(".onion") ||
      hostname.endsWith(".pages.dev") ||
      hostname === "metadata.google.internal" ||
      hostname === "0.0.0.0" ||
      hostname === "255.255.255.255" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("172.") &&
        Number(hostname.split(".")[1]) >= 16 &&
        Number(hostname.split(".")[1]) <= 31
    ) {
      return respond({ error: "Diese Adresse ist nicht erlaubt." }, 400);
    }

    if (!env.PAGESPEED_API_KEY) {
      return respond({ error: "API-Konfiguration fehlt." }, 503);
    }

    // Cloudflare Turnstile is enforced when both environment variables exist.
    // If only one is configured, fail closed rather than silently bypassing it.
    const hasSiteKey = Boolean(env.TURNSTILE_SITE_KEY);
    const hasSecret = Boolean(env.TURNSTILE_SECRET_KEY);
    if (hasSiteKey !== hasSecret) {
      return respond({ error: "Sicherheitsprüfung ist nicht vollständig konfiguriert." }, 503);
    }
    if (hasSiteKey && hasSecret) {
      const token = request.headers.get("X-Turnstile-Token") || "";
      if (!token || token.length > 2048) {
        return respond({ error: "Bitte die Sicherheitsprüfung abschliessen." }, 403);
      }
      let verification;
      try {
        const params = new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token
        });
        const clientIp = request.headers.get("CF-Connecting-IP");
        if (clientIp) params.set("remoteip", clientIp);
        const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
          signal: AbortSignal.timeout(8000)
        });
        if (!verifyResponse.ok) throw new Error("Turnstile siteverify unavailable");
        verification = await verifyResponse.json();
      } catch (error) {
        console.error("Turnstile verification failed", error?.message);
        return respond({ error: "Sicherheitsprüfung momentan nicht verfügbar." }, 503);
      }
      const expectedHost = new URL(request.url).hostname.toLowerCase();
      if (verification.success !== true ||
          String(verification.hostname || "").toLowerCase() !== expectedHost ||
          verification.action !== "website_check") {
        return respond({ error: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen." }, 403);
      }
    }

    // Only valid, public targets are eligible for caching. Normalize fragments:
    // they do not affect the network request or Lighthouse analysis.
    target.hash = "";
    const cacheKey = new Request(new URL(CACHE_PATH + encodeURIComponent(target.href), request.url));
    const edgeCache = typeof caches !== "undefined" ? caches.default : null;
    if (edgeCache) {
      try {
        const cached = await edgeCache.match(cacheKey);
        if (cached) {
          const result = await cached.json();
          return respond({ ...result, cached: true });
        }
      } catch (error) {
        console.warn("Website check cache read failed", error?.message);
      }
    }

    // Coalesce concurrent requests for the same URL within a single isolate.
    // Other isolates and regions remain independent.
    const key = target.href;
    if (inflight.has(key)) {
      const shared = await inflight.get(key);
      return shared.clone();
    }

    // Count only scans that actually need an upstream Google request.
    // Cached responses are served without consuming this local allowance.
    if (!allowClientScan(request)) {
      return respond({
        error: "Zu viele Prüfungen. Bitte in etwa zehn Minuten erneut versuchen."
      }, 429);
    }

    const run = async () => {
    const api = new URL(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    );

    api.searchParams.set("url", target.href);
    api.searchParams.set("strategy", "mobile");
    api.searchParams.append("category", "performance");
    api.searchParams.append("category", "accessibility");
    api.searchParams.append("category", "best-practices");
    api.searchParams.append("category", "seo");
    api.searchParams.set("key", env.PAGESPEED_API_KEY);

    // API-Kontingent in Google Cloud begrenzen. Ein Cloudflare Pages
    // Rate-Limit-Binding ist hier nicht eingerichtet; keinen Schutz vortäuschen.

    const response = await fetch(api.toString(), {
      signal: AbortSignal.timeout(45000)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PageSpeed API error", response.status, data.error?.status);
      return respond({
        error: response.status === 429
          ? "Google-Limit erreicht. Bitte später erneut versuchen."
          : "Die Google-Analyse ist derzeit nicht verfügbar."
      }, 502);
    }

    // Eine erfolgreiche Google-API-Antwort allein bestätigt keine gültige Messung.
    const lighthouse = data.lighthouseResult;
    const requiredCategories = ["performance", "accessibility", "best-practices", "seo"];
    const validScores = requiredCategories.every(id => {
      const score = lighthouse?.categories?.[id]?.score;
      return typeof score === "number" && Number.isFinite(score) &&
        score >= 0 && score <= 1;
    });
    const failedHttpStatus = lighthouse?.audits?.["http-status-code"]?.score === 0;

    if (lighthouse?.runtimeError || !validScores || failedHttpStatus ||
        !lighthouse?.finalUrl) {
      console.warn("Invalid Lighthouse analysis", {
        runtimeError: lighthouse?.runtimeError?.code || null,
        validScores,
        failedHttpStatus,
        hasFinalUrl: Boolean(lighthouse?.finalUrl)
      });
      return respond({
        error: failedHttpStatus
          ? "Die Website lieferte bei der Google-Prüfung keinen erfolgreichen HTTP-Statuscode. Bitte die Adresse und Erreichbarkeit kontrollieren."
          : "Google konnte die Website nicht vollständig auswerten. Bitte später erneut versuchen."
      }, 502);
    }

    const audits = lighthouse.audits || {};
    // Neue Lighthouse-Insights melden Einsparungen teils unter metricSavings
    // oder in details.items statt unter details.overallSavings*.
    const insightIds = new Set(["cache-insight", "render-blocking-insight", "image-delivery-insight"]);
    const positive = v => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    const savingsFor = (id, audit) => {
      const directMs = positive(audit.details?.overallSavingsMs);
      const directBytes = positive(audit.details?.overallSavingsBytes);
      if (!insightIds.has(id)) return { savingsMs: directMs, savingsBytes: directBytes };
      const metric = audit.metricSavings || {};
      const metricMs = Math.max(positive(metric.LCP) || 0, positive(metric.FCP) || 0);
      const rows = Array.isArray(audit.details?.items) ? audit.details.items : [];
      const rowBytes = rows.reduce((sum, row) => sum + (positive(row?.wastedBytes) || 0), 0);
      return {
        savingsMs: directMs ?? (metricMs > 0 ? metricMs : null),
        savingsBytes: directBytes ?? (rowBytes > 0 ? rowBytes : null)
      };
    };
    const categories = data.lighthouseResult?.categories || {};

    const checks = [
      ["document-title", "Seitentitel"],
      ["meta-description", "Meta-Beschreibung"],
      ["canonical", "Canonical-URL"],
      ["is-crawlable", "Indexierbarkeit"],
      ["heading-order", "Überschriftenstruktur"],
      ["viewport", "Viewport-Meta-Tag prüfen"],
      ["link-text", "Linktexte"]
    ].map(([id, name]) => ({
      id,
      name,
      score: audits[id]?.score ?? null,
      details: audits[id]?.title ?? null
    }));

   
const payload = {
  analyzedUrl: data.lighthouseResult?.finalUrl || target.href,
  strategy: "mobile",
  performance: categories.performance?.score ?? null,
  accessibility: categories.accessibility?.score ?? null,
  bestPractices: categories["best-practices"]?.score ?? null,
  seo: categories.seo?.score ?? null,
  metrics: {
    fcp: audits["first-contentful-paint"]?.displayValue ?? null,
    lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
    tbt: audits["total-blocking-time"]?.displayValue ?? null,
    cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
    speedIndex: audits["speed-index"]?.displayValue ?? null
  },
  checks,
  audits: Object.fromEntries(
  Object.entries(audits)
    .filter(([id, audit]) =>
      audit &&
      typeof audit.score === "number" &&
      audit.score < 0.9 &&
      !["manual", "informative", "notApplicable"].includes(audit.scoreDisplayMode)
    )
    .map(([id, audit]) => [
      id,
      {
        title: audit.title,
        score: audit.score,
        description: audit.description || null,
        scoreDisplayMode: audit.scoreDisplayMode,
        ...savingsFor(id, audit)
      }
    ])
),
  measuredAt: new Date().toISOString()
};
    if (edgeCache) {
      try {
        const stored = new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=" + CACHE_SECONDS
          }
        });
        await edgeCache.put(cacheKey, stored);
      } catch (error) {
        console.warn("Website check cache write failed", error?.message);
      }
    }
    return respond({ ...payload, cached: false });

    };
    const work = run();
    inflight.set(key, work);
    try {
      return (await work).clone();
    } finally {
      if (inflight.get(key) === work) inflight.delete(key);
    }
  } catch (error) {
    console.error("Website check failed", error?.message);
    return respond({
      error: "Analyse momentan nicht möglich. Bitte später erneut versuchen."
    }, 503);
  }
}
