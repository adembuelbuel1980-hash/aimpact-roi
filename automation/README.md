# Aimpact Website-Check – bestehender Betrieb

Stand: 2. November 2026. Abgabe KV-Abschlussarbeit: 9. Dezember 2026.

## Öffentlicher Kundenablauf

1. Startseite https://aimpact.ch/ verlinkt auf https://check.aimpact.ch/website-check. Der bisherige Pfad `sichtbarkeits-check.html` leitet dorthin weiter. Historische Selbsteinschätzungen bleiben im Versionsverlauf und in bestehenden Leads erhalten.
2. Kunde gibt seine Website-Adresse ein. Cloudflare Pages fragt Google PageSpeed Insights / Lighthouse ab. Ergebnis: Performance, Barrierefreiheit, Best Practices, technisches SEO, fünf technische Messwerte und ausgewählte tatsächliche Befunde.
3. Ergebnisse werden unmittelbar angezeigt. Google-Rankings, Google Maps, Unternehmensprofile und KI-Sichtbarkeit werden dabei nicht gemessen.
4. Optional sendet der Kunde Name, Unternehmen, E-Mail und die gemessenen Ergebnisse zur persönlichen Prüfung. Kein automatischer Versand eines Kundenberichts.

## Technischer Datenfluss

Bestehendes Cloudflare-Pages-Projekt `aimpact-v2-test`, Produktionsbranch `feature/visibility-check-v2-20261010`. Die Hauptwebsite bleibt im bestehenden GitHub-Pages-Branch `main`. GitHub Pages führt keine Pages Functions aus; deshalb kein pauschaler Merge des alten grossen Feature-PRs.

`functions/api/website-check.js` liefert echte Messwerte mit einem signierten Nachweis. Signaturschlüssel wird zweckgebunden aus dem bestehenden `PAGESPEED_API_KEY` abgeleitet und niemals ausgegeben. Messnachweis gültig zwei Stunden, Messwert-Cache zehn Minuten. `functions/api/website-check-lead.js` prüft Signatur, Gültigkeit, URL, Scores und bekannte Befunde. Vom Browser behauptete URLs/Scores ersetzen die signierten Werte nicht.

Die Pages-Funktion leitet die bestätigten Daten an den vorhandenen Worker weiter:
- Worker: https://aimpact-visibility-api.adembuelbuel1980.workers.dev/
- Vorhandenes Geheimnis `MAKE_WEBHOOK_URL`; D1-Binding `DB` auf `aimpact-visibility-leads`, Tabelle `processed_requests`.
- Eine UUID v4 bleibt für Wiederholungen erhalten. D1 verhindert erneutes Weiterleiten derselben ID. Unklare Annahmen bleiben zur manuellen Prüfung gesperrt.
- Status am Eingang immer `Neu`. Erst bestätigte Annahme zeigt Erfolg im Formular. Formspree bleibt eine zusätzliche Benachrichtigung nach Annahme.
- Kein neuer Worker und keine zusätzliche Tabelle angelegt.

## Make und Google Sheets

1. **8287125 – Aimpact – Visibility Check:** aktiver Webhook → bestehende Lead-Tabelle. Kein Gamma-Bericht durch eine neue Anfrage.
2. **8307884 – Aimpact – Freigabe & Bericht:** aktiv, stündlich höchstens eine Zeile mit H=`Freigegeben` und leerem I. Leere Suchergebnisse werden vor Verarbeitung gestoppt. Dieselbe Zeile wird `In Erstellung`; nur bei abgeschlossener Gamma-Generation mit URL folgen `Bericht erstellt` und Abschlusszeit. Beide Zeitstempel Europe/Zurich, Läufe nacheinander.

Tabelle: https://docs.google.com/spreadsheets/d/1IzZFdXgveHyX7mgAuBN-oj0-VYj-CB3BscmxuowpFeU/edit
Tab `Tabellenblatt1`, A–K: Datum, Unternehmen, Kontaktperson, E-Mail, Website, Visibility Score, Empfehlungen, Status, Berichtslink, Erstellung gestartet, Bericht erstellt am.

Für neue technische Leads ist F ausschliesslich der Performance-Wert, kein Sichtbarkeitsscore. G beginnt exakt mit `Technischer Website-Check |` und enthält Quelle, Messzeit, vier Kategorien, fünf Messwerte und bis zu drei Befunde. Bestehende Spalten und Make-Mappings bleiben erhalten. Alte Selbsteinschätzungswerte werden nicht umgedeutet.

Gamma-Modul 7 unterscheidet anhand dieses Präfixes technische Berichte und frühere Selbsteinschätzungen. Vollständige ISO-Messzeit inklusive Sekunden/Millisekunden/Z unverändert übernehmen. Image source = No images; keine künstlichen Dashboard-Zahlen. Die Messwertkarte heisst Technische Labormesswerte; FCP/TBT/Speed Index nicht als Core Web Vitals ausgeben. Nur B/E/F/G werden übergeben; keine Kontaktperson/E-Mail/Telefonnummer. Unternehmen und untersuchte Website müssen exakt erhalten bleiben. Aimpact/aimpact.ch ist nur die Autorenangabe. Private Entwürfe, externe Freigabe deaktiviert, Indexierung aus, keine Nachrichten.

## Nachweise am 2. November 2026

- Reale Prüfung von https://aimpact.ch/: Messzeit `2026-11-02T06:28:08.074Z`, mobile; Performance 100, Barrierefreiheit 95, Best Practices 100, technisches SEO 100. FCP/LCP/Speed Index 0.8 s, TBT 10 ms, CLS 0. Momentaufnahme, kein Rankingnachweis.
- Öffentliche Eingabe und Formularversand erfolgreich. Genau eine neue Testzeile 9 `Aimpact Technik-Test 02.11.2026` mit signierten Messdaten, zunächst `Neu`. Keine Überschreibung alter Testzeilen.
- Nur Zeile 9 freigegeben. Make erzeugte nach 39 Sekunden den privaten Link https://gamma.app/docs/nx8pdi3q2h21rz5, Start 07:29:53, Abschluss 07:30:32.
- Erster Gamma-Testbericht nach Wiederherstellung der Browser-Verbindung geprüft: URL, Kategorien, fünf Messwerte und Befunde stimmen. Dabei fiel eine verkürzte Zeitangabe und ein dekoratives Dashboard-Bild mit künstlichen Zahlen auf. Deshalb wurde die Vorlage anschliessend verschärft; diesen ersten Testbericht nicht als Kundenvorlage verwenden.
- 24 lokale Tests bestanden: echter Analyseaufruf/Anzeige, signierter Versand, Schutz vor Wiederholung und alten Ergebnissen, fehlende/manipulierte/abgelaufene Nachweise, fehlerhafte Google-Antworten, Quotenfehler, optionale Turnstile-Prüfung.
- Bestehende CI-Workflows korrigiert: echte Route `/website-check` statt alter Meta-Weiterleitungsdatei; aktuelle Datenschutzerklärung; alle drei Testsuiten. Commit `1af92c22eac852ab0fcc7094c8ab569a6d83d343`: Cloudflare Pages, beide Deployment-Smokes und Security-Tests erfolgreich.

## Zweiter vollständiger Test und abschliessende Prüfung

- Zweite öffentlich analysierte Website: https://example.com/, mobile, `2026-11-02T06:44:36.370Z`. Tatsächliche Kategorien: Performance 100, Barrierefreiheit 96, Best Practices 100, technisches SEO 80. FCP/LCP/Speed Index 0.8 s; TBT 0 ms; CLS 0.
- Neues synthetisches Formular `Aimpact Test Zweite Website 02.11.2026` kam genau einmal als Zeile 10 mit H=Neu an. Nur diese Zeile wurde anschliessend freigegeben. Alte Zeilen blieben erhalten.
- Automatischer Bericht nach Vorlagekorrektur: https://gamma.app/docs/r59ru82abaxix45. Start 07:46:32, Abschluss 07:47:14 (Europe/Zurich).
- Bericht im angemeldeten Gamma geöffnet: exakt https://example.com/ als untersuchte Website, alle vier Kategorien und fünf Messwerte stimmen, vollständige ISO-Messzeit exakt erhalten, fünf Karten, TESTBERICHT, private interne Freigabe, keine künstliche Dashboard-Illustration. Rankings/Maps/KI-Sichtbarkeit explizit Nicht geprüft.
- Erneuter Make-Lauf um 07:48 übersprang abgeschlossene Zeilen: nur Search Rows, Filter blockiert, keine weitere Gamma-Generation.
- Hauptwebsite öffentlich kontrolliert: fünf primäre Check-Links führen zur echten Analyse. Alte URL https://aimpact.ch/sichtbarkeits-check.html leitet tatsächlich weiter. Beschreibung der sechs Selbsteinschätzungsfragen auf Hauptseite, Gastronomie-Seite und im Assistenten ersetzt. Assistent im Browser nach neuer Asset-Version geprüft: Website-Adresse, vier technische Kategorien und richtiger Link.
- Datenschutzhinweise zu Pages, PageSpeed, signierten Messwerten und freiwilligem Kontaktversand in den vorhandenen Dateien aktualisiert.
- Commit `831ba441e5543526cfe5b36cd30ff38e21b1e31a`: alle technischen Deployment-/Sicherheitstests erfolgreich. Commit `69f65770c63a930bfd63a2365110a29c7435b93e`: Hauptseiten-Veröffentlichung erfolgreich.
- Messzeit auf der Check-Seite jetzt mit expliziter Zeitzone Europe/Zurich. Browser-Zeitzonen dürfen den Messtag nicht missverständlich verschieben.

## Freigabe- und Fehlerregeln

- H=`Freigegeben` nur nach Prüfung des gewünschten Leads setzen.
- `In Erstellung` ohne Link: zuerst Make-Protokoll und vorhandene Gamma-Generation prüfen. Nicht blind neu freigeben, keine automatische Doppelgeneration.
- Abgeschlossene Zeilen mit vorhandenem I werden übersprungen. Bestehende Doppelschutztests vom 1. November bleiben gültig.
- "Live" nur für nachweislich bereitgestellte und öffentlich getestete Schritte verwenden. Konfiguration, Veröffentlichung, Datenankunft und Berichtsinhalt separat nachweisen.
- Kein vollständiger globaler Missbrauchsschutz bestätigt: das derzeitige Limit gilt pro Ausführungsinstanz, Origin/CORS ist kein Bot-Schutz. Optionaler Turnstile-Code ist vorhanden; Aktivierung und globales Limit sind separat zu prüfen.
- Suchlauf pro Stunde braucht etwa 720–744 Make-Credits pro Monat plus Leads/Berichte. Bestehendes Free-Kontingent überwachen.

## Priorisierte Fertigstellung bis zur KV-Abgabe

Die Termine sind Arbeitsziele, keine zusätzlichen Schulvorgaben.

| Priorität | Zieltermin | Aufgabe | Fertig, wenn |
|---|---|---|---|
| Erledigt | 2. November | Gamma-Testbericht abgleichen | Zweite Website, vier Kategorien, fünf Messwerte, exakte ISO-Zeit, Quelle und TESTBERICHT bestätigt; Vorlage ohne künstliche Zahlenbilder |
| P0 | vor breiter Bewerbung | Turnstile und dauerhaftes globales Quoten-/Missbrauchslimit prüfen und fertigstellen | Nachweis gegen ungültige Tokens und verteilte Überlastung; Google- und Make-Kosten begrenzt |
| Erledigt | 2. November | Zweite reale Website mit synthetischem Kontakt testen | example.com mit abweichenden Kategorien korrekt in Zeile 10 und privatem Bericht; Doppellauf übersprungen |
| P1 | 13. November | Bestehende KV-Unterlagen mit Ziel, Ausgangslage, Architektur, Testprotokollen und Eigenleistung ergänzen | Nachweise und klare Grenzen der technischen Messung dokumentiert |
| P1 | 20. November | Betrieb und Nutzen auswerten | Reale Fälle, Bearbeitungszeit, Fehlerquote und Creditverbrauch nachvollziehbar; keine erfundenen Conversion-Zahlen |
| P1 | 30. November | Vollständigen Entwurf der Abschlussarbeit prüfen | Schulvorgaben anhand der vorhandenen Aufgabenstellung abgeglichen; Quellen, Datenschutz, Reflexion und Anhänge vollständig |
| P2 | 5. Dezember | Abgabeversion kontrollieren und sichern | Text, Abbildungen, Verweise und Dateien überprüft; funktionierender Stand dokumentiert |
| Termin | 9. Dezember 2026 | KV-Abschlussarbeit abgeben | Abgabe bestätigt |

## Historische Nachweise am 1. November 2026

- Cloudflare: gleiche Test-ID einmal angenommen, danach als Duplikat erkannt.
- Make Freigabe: ohne Freigabe nur Suche; freigegebene Systemtest-Zeile erfolgreich in 39 Sekunden (7 Operationen); erneuter Lauf übersprang die abgeschlossene Zeile.
- Öffentliches Formular auf https://aimpact.ch/sichtbarkeits-check.html nach Merge von PR #16 geprüft: Erfolgsmeldung und exakt eine neue Zeile 8 (Aimpact Live-Test 01.11.2026, https://example.com, Score 49, Status Neu). Keine neue Gamma-Generation durch Eingang.
- Szenario 8287125 wurde aktiviert und der öffentliche Test automatisch verarbeitet.
- Szenario 8307884 wurde nach ausdrücklicher Nutzerfreigabe aktiviert. Make zeigt Active. Erster geplanter Lauf am 01.11.2026 um 17:51:12 (Europe/Zurich): Success, 1 Operation, keine freigegebene Zeile. Der stündliche Berichtsbetrieb ist aktiv; Freigabe einzelner Leads erfolgt weiterhin über Status H=Freigegeben.

## Vorbereitet am 2. November: dauerhafter Missbrauchs- und Kostenschutz (NOCH NICHT LIVE)

Status: 34 lokale Tests bestanden. Cloudflare-Browserverbindung ist während der Einrichtung abgebrochen; es wurde noch keine D1-Bindung gespeichert und kein neuer Worker veröffentlicht. Bestehende Produktionsbranches wurden für diese Änderung nicht verändert.

Geprüfter Entwurf:
- Bestehende D1-Datenbank aimpact-visibility-leads wiederverwenden. Additives Schema in automation/abuse-limits.sql, bestehende processed_requests bleiben unberührt.
- PageSpeed: höchstens 50 reservierte neue Prüfungen pro UTC-Tag, vier pro UTC-Minute und drei pro Client in einem festen Zehn-Minuten-Fenster. Cache-Treffer und bereits laufende identische Prüfungen benötigen keine zusätzliche Google-Reservierung.
- Make-Eingang: höchstens 20 neue Reservierungen pro Kalendermonat UTC, zehn pro UTC-Tag, drei pro UTC-Minute. Die vorsichtige Pilotgrenze schützt das Make-Free-Kontingent; stündliche Suche, manuell freigegebene Gamma-Berichte und andere Szenarien verbrauchen separat Credits. Keine Garantie für kostenlose Gesamtnutzung.
- Zähler sind atomare bedingte SQL-Schreibvorgänge. Regionen und Neustarts teilen denselben D1-Zustand. Bei fehlender Bindung oder ungeklärtem Schreibresultat werden Google/Make nicht aufgerufen.
- Reservierungen erfolgen vorsichtig nacheinander: auch abgelehnte Versuche und spätere Upstream-Fehler können bereits reservierte übergeordnete Kontingente verbrauchen. Es gibt keine automatischen Rückerstattungen. Die Grenzen sind Obergrenzen, keine zugesicherte Anzahl erfolgreicher Prüfungen.
- Erfolgreich gespeicherte Lead-Duplikate bleiben auch bei vollem Budget erfolgreich, ohne Make erneut aufzurufen. Bei 429 wird kein neuer Lead gesperrt; Retry-After wird bis zum Formular-Endpunkt weitergegeben.
- Keine rohen IP-Adressen in D1. Clientkennung ist täglich wechselnd und mit bestehendem Geheimnis gesalzen. Bei erfolgreichen neuen Analysen werden höchstens 100 seit über 48 Stunden abgelaufene technische Zähler aufgeräumt; Lead-Registry bleibt erhalten.
- Der bereits vorhandene Turnstile-Code bleibt bestehen. Die Produktivkonfiguration muss noch eingerichtet und getestet werden. Eine Origin-Prüfung allein ist keine Absenderauthentifizierung. Die festen Make-Grenzen gelten deshalb auch bei gefälschter Origin.

Verbleibende Aktivierung im bestehenden Projekt:
1. Cloudflare-Verbindung wiederherstellen. Im offenen Dialog nur die Bindung DB zur bestehenden aimpact-visibility-leads speichern (Production), keine neue Datenbank.
2. automation/abuse-limits.sql in dieser Datenbank ausführen und Tabelle/Index prüfen.
3. Bestehendes Turnstile-Widget prüfen oder konfigurieren; richtige Hostnamen/action website_check, Produktionsvariablen TURNSTILE_SITE_KEY und TURNSTILE_SECRET_KEY, Geheimnis niemals veröffentlichen.
4. Datenschutz um pseudonyme Schutzkennung und deren Aufräumregel ergänzen; nur tatsächlich aktivierte Verarbeitung beschreiben.
5. Erst bei vorhandener Bindung und Tabelle den getesteten Pages-Code auf den bestehenden Produktionsbranch übernehmen. Bestehenden Worker aus automation/visibility-check-worker.js im gleichen Worker aimpact-visibility-api veröffentlichen; vorhandene DB und MAKE_WEBHOOK_URL erhalten. Keine neue Automation.
6. Normale öffentliche Analyse und genau eine synthetische Lead-Anfrage prüfen. Zähler im vorhandenen D1 kontrollieren. Gezielter Grenztest mit isolierten technischen Testzählern; echte Tages-/Monatskontingente nicht mit künstlichen Lasttests ausschöpfen.
7. Erst nach öffentlichem Nachweis als live markieren. Kein pauschaler Merge von Feature-Branches in main.

Validierung: 34 Tests mit echtem lokalem SQLite, unter anderem parallele SQL-Reservierungen, getrennte Servermodule mit gemeinsamem Zähler, globale Grenze bei wechselnden Clients, Zeitfensterwechsel, Datenbankausfall, Make-Tages-/Monatsgrenze, Duplikate und Weitergabe der Wartezeit. Noch keine Live- oder Lasttest-Bestätigung.
