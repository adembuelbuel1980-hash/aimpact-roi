
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
    const ipLiteral = hostname.startsWith("[") || /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(hostname);
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

   
return respond({
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
});

  } catch (error) {
    console.error("Website check failed", error?.message);
    return respond({
      error: "Analyse momentan nicht möglich. Bitte später erneut versuchen."
    }, 503);
  }
}
