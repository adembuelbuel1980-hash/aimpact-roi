// Public configuration for the Website-Check security challenge.
// The Turnstile secret key is never exposed to the browser.
export function onRequestGet({ env }) {
  const siteKey = String(env.TURNSTILE_SITE_KEY || "").trim();
  const secretPresent = Boolean(env.TURNSTILE_SECRET_KEY);
  const ready = Boolean(siteKey && secretPresent);
  const incomplete = Boolean(siteKey) !== secretPresent;
  return new Response(JSON.stringify({
    turnstileEnabled: ready,
    configurationError: incomplete,
    siteKey: ready ? siteKey : null
  }), {
    status: incomplete ? 503 : 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
