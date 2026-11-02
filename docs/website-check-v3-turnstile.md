# Aimpact Website-Check V3 – Turnstile-Aktivierung (Testprojekt)

**Nur Cloudflare Pages `aimpact-v2-test`. Keine Änderungen an `aimpact.ch` oder GitHub `main`.**

## Einrichtung durch Kontoinhaber

1. In Cloudflare unter **Turnstile** ein neues Widget anlegen. Den Hostnamen **`aimpact-v2-test.pages.dev`** zulassen (ohne `https://`, ohne Pfad). Für den Test nach Möglichkeit Managed-Modus wählen.
2. Im Projekt **Workers & Pages → aimpact-v2-test → Settings → Production → Variables and secrets** zwei Variablen anlegen:
   - `TURNSTILE_SITE_KEY`: **Text**, öffentlicher Site Key.
   - `TURNSTILE_SECRET_KEY`: **Secret**, geheimer Secret Key (niemals in GitHub, Chats oder Screenshots offenlegen).
3. Deployment im **Testprojekt** neu auslösen, damit beide Variablen für Pages Functions verfügbar sind.
4. `https://aimpact-v2-test.pages.dev/api/website-check-config` aufrufen: `turnstileEnabled` muss `true` und `configurationError` muss `false` sein. `siteKey` ist absichtlich öffentlich; der Secret Key wird nicht ausgegeben.
5. `https://aimpact-v2-test.pages.dev/website-check-v3-neu.html` öffnen: Turnstile-Widget muss vor dem Analyse-Button erscheinen. Ohne gültige Prüfung muss der API-Endpunkt HTTP **403** liefern; nach Prüfung soll der Website-Check wie bisher funktionieren.
6. Testformular mit eigener Adresse ausfüllen und Eingang prüfen. Kein Produktions-Merge ohne ausdrückliche Freigabe.

## Implementierung

- Das Frontend lädt die öffentliche Konfiguration aus `/api/website-check-config`. Wenn Turnstile konfiguriert ist, lädt es das Cloudflare-Script und sendet den einmalig gültigen Token im Header `X-Turnstile-Token`.
- `functions/api/website-check.js` prüft jeden Token über Cloudflare `siteverify`, inklusive Hostname und Action `website_check`, **vor** dem Cache-Lookup und dem Google-Aufruf.
- Fehlt genau eine der beiden Variablen, wird der Website-Check gesperrt (HTTP 503). Sind beide nicht gesetzt, bleibt die bisherige Testfunktion bewusst aktiv und **ungeschützt**.
- Turnstile erschwert automatisierte Zugriffe, ersetzt aber **keine harte globale oder IP-basierte Rate-Limit-Regel**. Die bereits eingestellten Google-Kontingente (laut Kontoinhaber 5/min, 100/Tag) begrenzen den Verbrauch. Der 10-Minuten-Cache ist nur best-effort.
- Beim Einsatz mit weiteren Hostnamen oder Preview-URLs müssen die zugelassenen Hostnamen und der Server-Hostname-Check entsprechend geprüft werden.

## Freigabekriterien

- [ ] Site Key und Secret Key im Cloudflare-Testprojekt korrekt konfiguriert
- [ ] Turnstile-Challenge sichtbar und Siteverify erfolgreich
- [ ] API ohne Token liefert 403 (nicht 200)
- [ ] Website-Analyse nach gültiger Challenge erfolgreich
- [ ] Leadformular versendet und Test-E-Mail empfangen
- [ ] Fehlerfälle und Verbrauchsgrenzen getestet
- [ ] Datenschutztexte für Turnstile ergänzt und geprüft
- [ ] Explizite Freigabe für öffentliche Veröffentlichung eingeholt
