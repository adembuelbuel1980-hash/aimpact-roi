# Aimpact Website-Check V3 – Release-Gate (13.10.2026)

## Architektur (verifiziert im Repository)
- `aimpact.ch` ist über GitHub Pages mit `CNAME=aimpact.ch` konfiguriert.
- Website-Check V3 läuft als Cloudflare Pages Functions unter `/api/website-check`.
- Das V3-Frontend ruft die API und die öffentliche Sicherheitskonfiguration **relativ zum eigenen Host** auf.
- Ein Merge von PR #4 nach GitHub `main` allein stellt die API auf `aimpact.ch` **nicht** bereit.

## Aktueller Stand
- Cloudflare-Testprojekt: `aimpact-v2-test.pages.dev`.
- GitHub CI: API-Sicherheitstests und HTTP-Smoke-Test für Testseite und öffentliche Konfiguration bestanden.
- Manuelle E2E-Abnahme (Analyse → Leadformular → E-Mail) ist für einen früheren Teststand dokumentiert.
- Google-Cloud-Kontingente laut Kontoinhaber: 5/min und 100/Tag.
- Turnstile nicht aktiviert. IP-basierte Begrenzung im Worker gilt nur pro Isolate, **nicht global**.
- Test- und Live-Domain sind nicht gleich; `main` ist ungemergt.

## Sichere Veröffentlichungsvariante
1. **Separaten produktiven Cloudflare-Pages-Host** für den Check wählen, z. B. `check.aimpact.ch` (noch nicht eingerichtet). `aimpact.ch` und bestehendes GitHub-Pages-Hosting bleiben unangetastet.
2. In Cloudflare eine entsprechende Custom Domain am Cloudflare-Pages-Projekt anbinden und DNS-Einträge nur gemäss den von Cloudflare konkret angezeigten Vorgaben setzen. **Keine pauschalen Änderungen an Apex-/www-DNS.**
3. Cloudflare-Umgebung für den produktiven Host konfigurieren: `PAGESPEED_API_KEY` als Secret; global wirksamen Missbrauchsschutz einrichten und verifizieren (z. B. geeignetes Rate Limiting oder Challenge). Nur Isolate-Map und Google-Quota sind kein vollständiger Schutz.
4. Die **tatsächlich veröffentlichte** Seite, API, Fehlerfälle, Formularzustellung, Datenschutz und Mobile-Ansicht unter dem finalen Host end-to-end testen.
5. Erst dann einen Link vom bestehenden `aimpact.ch`-Visibility-Check auf die neue Hostadresse setzen. Separat freigeben und deployen.

## Stop-Kriterien
- Kein produktiver API-Host, kein wirksamer globaler Schutz oder kein End-to-End-Test am finalen Host → **nicht öffentlich bewerben**.
- PR #4 nicht blind nach `main` mergen; GitHub Pages kann `functions/` nicht ausführen.
- Keine Secrets in GitHub-Dateien, Chat oder Screenshots.

## Noch benötigte Nutzerentscheidung
- Gewünschter finaler Host: `check.aimpact.ch` oder eine andere Subdomain.
- Cloudflare Custom-Domain-Einrichtung benötigt Zugriff auf das Cloudflare-Konto und ggf. DNS-Bestätigung.
