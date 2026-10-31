# Aimpact Visibility Check – Make integration (staged)

The public form still submits to Formspree. After a **successful** Formspree response, an optional secondary request goes to a Cloudflare Worker. That worker forwards validated lead data to Make without publishing the Make webhook URL.

## Activation (not performed)

1. Deploy `automation/visibility-check-worker.js` as a Cloudflare Worker.
2. Configure `MAKE_WEBHOOK_URL` as a **Worker secret** (create a new webhook URL; the previous test URL was exposed).
3. Configure `ALLOWED_ORIGIN=https://aimpact.ch` and apply Cloudflare rate limiting/Turnstile to reduce spam; Origin checks alone are not authentication.
4. Review privacy notice, Make/Gamma processing and consent. Confirm API usage and prohibit unreviewed outbound customer reports.
5. In `sichtbarkeits-check.html`, set `meta[name=aimpact-automation-endpoint]` to the Worker URL.
6. Test once with synthetic data; verify Formspree, Make, Sheet and Gamma without duplicates. Keep the Make scenario disabled until approval.

Without step 5 the website behaves **exactly as before**, with no Make requests. No credential is committed to Git.
The score and recommendations originate from user self-assessment, not an audited business analysis. Website is blank because the existing form does not collect a URL. Telephone/individual scores are sent but are not added to the existing eight Google Sheets columns unless Make is extended.
