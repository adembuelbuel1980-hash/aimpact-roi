# Aimpact Visibility Check – bestehender Betrieb

## Datenfluss

Das öffentliche Formular in `sichtbarkeits-check.html` übermittelt über den Cloudflare Worker an Make. Eine bestätigte Annahme am Eingang ist Voraussetzung für die Erfolgsmeldung. Formspree bleibt danach als zusätzliche Benachrichtigung erhalten; ein Formspree-Ausfall verwirft keinen bereits angenommenen Lead.

- Worker: `https://aimpact-visibility-api.adembuelbuel1980.workers.dev/`
- Geheimnis `MAKE_WEBHOOK_URL` bleibt ausschliesslich im Worker.
- D1-Binding `DB`: bestehende Datenbank `aimpact-visibility-leads`, Tabelle `processed_requests`.
- Pro Formularversuch wird eine UUID v4 erzeugt und für Wiederholungen beibehalten. D1 verhindert erneutes Weiterleiten derselben ID.
- Unklare oder fehlgeschlagene Weiterleitung bleibt für manuelle Prüfung gesperrt. Make-HTTP-Annahme allein beweist noch keinen Tabelleneintrag.

## Bestehende Make-Szenarien

1. **8287125 – Aimpact – Visibility Check:** Webhook → bestehende Google-Sheets-Tabelle. Der Worker erzwingt Status `Neu`; neue Anfragen erzeugen keinen Gamma-Bericht.
2. **8307884 – Aimpact – Freigabe & Bericht:** stündlich höchstens eine Zeile mit H=`Freigegeben` und leerem I. Leere Suchergebnisse werden vor der Verarbeitung gestoppt. Dieselbe Zeile wird auf `In Erstellung` gesetzt; nach abgeschlossener Gamma-Erstellung folgen Link, `Bericht erstellt` und Abschlusszeit. Beide Zeitstempel verwenden Europe/Zurich. Läufe erfolgen nacheinander.

Tabelle: https://docs.google.com/spreadsheets/d/1IzZFdXgveHyX7mgAuBN-oj0-VYj-CB3BscmxuowpFeU/edit

Spalten A–K: Datum, Unternehmen, Kontaktperson, E-Mail, Website, Visibility Score, Empfehlungen, Status, Berichtslink, Erstellung gestartet, Bericht erstellt am. Telefonnummer/Einzelwerte werden am Eingang mitgesendet, aber nicht in diesen Spalten gespeichert. Kontaktangaben gehen nicht an Gamma.

## Bedienung und Fehler

- Vorhandenen Lead prüfen; nur bei gewünschtem Bericht H auf `Freigegeben` setzen.
- Der Bericht ist ein privater Entwurf aus Selbsteinschätzung, keine echte Ranking- oder KI-Sichtbarkeitsmessung. Vor Weitergabe fachlich prüfen.
- Bei `In Erstellung` ohne Link zuerst Ausführungsprotokoll und vorhandene Gamma-Generation prüfen. Nicht blind neu freigeben oder Generation wiederholen.
- Keine automatische Kunden-E-Mail und keine öffentliche Gamma-Freigabe.
- Ein Suchlauf pro Stunde braucht etwa 720–744 Credits pro Monat, zusätzlich zu Leads/Berichten. Make-Free-Kontingent im Blick behalten.
- CORS/Origin-Prüfung ist kein Bot-Schutz. Ein separater verifizierter Turnstile-/Rate-Limit-Schutz ist in diesem Worker nicht eingerichtet.

## Nachweise am 1. November 2026

- Cloudflare: gleiche Test-ID einmal angenommen, danach als Duplikat erkannt.
- Make Freigabe: ohne Freigabe nur Suche; freigegebene Systemtest-Zeile erfolgreich in 39 Sekunden (7 Operationen); erneuter Lauf übersprang die abgeschlossene Zeile.
- Öffentliches Formular auf https://aimpact.ch/sichtbarkeits-check.html nach Merge von PR #16 geprüft: Erfolgsmeldung und exakt eine neue Zeile 8 (Aimpact Live-Test 01.11.2026, https://example.com, Score 49, Status Neu). Keine neue Gamma-Generation durch Eingang.
- Szenario 8287125 wurde aktiviert und der öffentliche Test automatisch verarbeitet.
- Szenario 8307884 wurde nach ausdrücklicher Nutzerfreigabe aktiviert. Make zeigt Active. Erster geplanter Lauf am 01.11.2026 um 17:51:12 (Europe/Zurich): Success, 1 Operation, keine freigegebene Zeile. Der stündliche Berichtsbetrieb ist aktiv; Freigabe einzelner Leads erfolgt weiterhin über Status H=Freigegeben.
