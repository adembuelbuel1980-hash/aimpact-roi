
export async function onRequestGet({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  };

  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  try {
    const input = new URL(request.url).searchParams.get("url");

    if (!input) {
      return respond({ error: "Website-Adresse fehlt." }, 400);
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
    if (
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
    api.searchParams.set("category", "performance");
    api.searchParams.set("category", "seo");
    api.searchParams.set("key", env.PAGESPEED_API_KEY);

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

    const audits = data.lighthouseResult?.audits || {};
    const categories = data.lighthouseResult?.categories || {};

    const checks = [
      ["document-title", "Seitentitel"],
      ["meta-description", "Meta-Beschreibung"],
      ["canonical", "Canonical-URL"],
      ["is-crawlable", "Indexierbarkeit"],
      ["heading-order", "Überschriftenstruktur"],
      ["viewport", "Mobile Darstellung"],
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
      seo: categories.seo?.score ?? null,
      checks,
      measuredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Website check failed", error?.message);
    return respond({
      error: "Analyse momentan nicht möglich. Bitte später erneut versuchen."
    }, 503);
  }
}
