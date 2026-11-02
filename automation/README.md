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
- Cloudflare Turnstile und gemeinsame D1-Kontingente sind seit 2. November aktiv. Origin/CORS bleibt keine Absenderauthentifizierung; die Make-Eingangsgrenzen gelten auch bei gefälschter Origin. Kein vollständiger Schutz vor jeder Form von Missbrauch zugesichert.
- Suchlauf pro Stunde braucht etwa 720–744 Make-Credits pro Monat plus Leads/Berichte. Bestehendes Free-Kontingent überwachen.

## Priorisierte Fertigstellung bis zur KV-Abgabe

Die Termine sind Arbeitsziele, keine zusätzlichen Schulvorgaben.

| Priorität | Zieltermin | Aufgabe | Fertig, wenn |
|---|---|---|---|
| Erledigt | 2. November | Gamma-Testbericht abgleichen | Zweite Website, vier Kategorien, fünf Messwerte, exakte ISO-Zeit, Quelle und TESTBERICHT bestätigt; Vorlage ohne künstliche Zahlenbilder |
| Erledigt | 2. November | Kontingentsperre und bestätigte Worker-Weiterleitung fertigstellen | Live-Grenztest bestanden; bestätigter Formularversand erfolgreich; direkter Aufruf trotz Aimpact-Origin mit 403 Unauthorized intake gestoppt |
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

## Aktivierter Schutz am 2. November 2026

- Production Pages: DB-Bindung zur bestehenden Datenbank aimpact-visibility-leads gespeichert; additive Tabelle abuse_limits samt Ablaufindex erfolgreich eingerichtet. Bestehende processed_requests bleiben erhalten.
- Neues Turnstile-Widget Aimpact Website-Check, Managed, ausschliesslich check.aimpact.ch, ohne Pre-Clearance. Öffentlicher Site-Key und verschlüsseltes Secret in Production hinterlegt; Geheimnis nicht in Git.
- Pages-Produktion auf a867aca2a290e03a12c1bc09417a972e8e1515f1 veröffentlicht. Cloudflare Pages, Security-Tests und beide Smoke-Prüfungen erfolgreich. 34 Tests bestehen; SQL wird mit echtem lokalem SQLite geprüft.
- Bestehender Worker aimpact-visibility-api mit getestetem Quelltext veröffentlicht. Editorinhalt vor Veröffentlichung vollständig mit Git-Quelle verglichen. Explizite numerische Zeitrechnung beseitigt die Typprüfmeldung; Cloudflare-Editor meldet anschliessend keine Probleme. Keine neue Automation.
- Verbindliche Obergrenzen: neue Google-Reservierungen 50/UTC-Tag, 4/UTC-Minute, 3/Client pro festem Zehn-Minuten-Fenster. Make-Reservierungen 20/UTC-Kalendermonat, 10/UTC-Tag, 3/UTC-Minute. Übergeordnete Reservierungen können auch bei später abgelehnten Versuchen oder externen Fehlern verbraucht werden. Keine automatische Rückerstattung; Cache-Treffer brauchen keine neue Google-Reservierung.
- Datenschutz in beiden bestehenden Bereitstellungen um Sicherheitsprüfung und pseudonyme Clientkennung ergänzt. Keine rohen Client-IP-Adressen in den Kontingentzählern; Aufräumen seit über 48 Stunden abgelaufener Zähler bei erfolgreichen neuen Prüfungen.
- Öffentlicher Positivtest im angemeldeten Browser: Sicherheitsprüfung automatisch erfolgreich; Analyse von https://aimpact.ch/ vollständig. Messzeit 2026-11-02T07:55:55.901Z (08:55:55 Europe/Zurich). D1 zeigte je eine Tages-, Minuten- und Clientreservierung.
- Testformular Aimpact Schutztest 02.11.2026 genau einmal in Tabellenblatt1, Zeile 11, eingetroffen; H=Neu, Berichtslink leer. Vier Kategorien 100/95/100/100, TBT20ms, übrige Messwerte korrekt. Kein Gamma-Bericht durch Eingang ausgelöst.
- Zweiter öffentlicher Negativtest: ohne abgeschlossene Sicherheitsprüfung zeigt das Formular „Bitte zuerst die Sicherheitsprüfung abschliessen“. Keine CAPTCHA-Herausforderung automatisch gelöst.
- Noch offen: vollständiger öffentlicher 429-Grenztest. Nur der eigene technische Clientzähler wurde hierfür versuchsweise vorbereitet (Fensterende 2026-11-02T08:00:00Z); die Browserverbindung stockte danach. Das zeitlich begrenzte Testfenster ist inzwischen abgelaufen. Kein allgemeines Tages-/Monatskontingent zurückgesetzt oder künstlich ausgeschöpft. Die Dauerhaftigkeit und Grenzen sind durch Quelltext, 34 Tests, erfolgreiche D1-Reservierungen und produktive Datenankunft belegt; dieser zusätzliche Live-Sperrnachweis wird nicht als erledigt ausgegeben.
- Nächster Sicherheitsschritt: Pages-zu-Worker-Weiterleitung zusätzlich authentifizieren. Origin allein verhindert keine direkten Fremdaufrufe; die bereits aktiven harten Make-Kontingente begrenzen deren Weiterleitung.

## Fortsetzung: Live-Grenztest abgeschlossen; Weiterleitungsprüfung vorbereitet

Am 2. November wurde der tatsächliche öffentliche Grenzfall nach erfolgreicher normaler Analyse bestätigt: nur der eigene Clientzähler im aktiven Testfenster wurde vorübergehend auf 3 gesetzt. Eine neue, nicht zwischengespeicherte Ziel-URL wurde mit „Das Anfragelimit ist erreicht“ abgewiesen. Danach wurde ausschliesslich dieser Testzähler per bedingtem UPDATE auf den ursprünglichen Wert 1 zurückgesetzt; Cloudflare bestätigte beide Schreibvorgänge. Allgemeine Tages- und Monatszähler blieben erhalten. Der vorher als offen dokumentierte Live-Grenztest ist damit erledigt.

Zusätzliche Absicherung ist auf feature/abuse-cost-limits-20261102 vorbereitet, NICHT produktiv: Pages hinterlegt nach Prüfung des signierten Messnachweises eine fünf Minuten gültige, an Anfrage-ID und exakten Nutzdatenhash gebundene Bestätigung in der vorhandenen D1-Datenbank. Worker prüft diese vor neuen Make-Aufrufen. Gefälschte Origin allein genügt dann nicht mehr. Keine weiteren Konten oder Geheimnisse nötig. 35 lokale Tests bestanden, einschliesslich Ablehnung direkter unbestätigter Anfragen.

Aktivierungsfolge: Existenz der additiven Tabelle intake_authorizations prüfen (Erstellungsversuch im Cloudflare-Dialog wurde wegen erneutem Verbindungsstillstand nicht bestätigt); danach zuerst Pages mit bestätigter Datenbankbindung veröffentlichen, dann den bestehenden Worker ersetzen, anschliessend normalen synthetischen Eingang und direkten unbestätigten Zugriff prüfen. Quelltext de2e54082121ce7e14dee946988949f97ac7d339. Alte Produktionsversion bleibt bis dahin aktiv. Neue Hash-Bestätigungen enthalten keine Klartext-Kontaktdaten und werden nach Ablauf plus 48 Stunden bei neuen Übermittlungen begrenzt aufgeräumt.

## Aktualisierung der Weiterleitungsprüfung

Am 2. November wurde intake_authorizations in der bestehenden D1-Datenbank erfolgreich angelegt (Cloudflare-Erfolgsmeldung). Pages-Produktionsbranch wurde kontrolliert von 88da1e21580b2b5e5caf3b9835af314361cae11c auf de2e54082121ce7e14dee946988949f97ac7d339 vorgerückt; Cloudflare Pages und alle CI-Prüfungen erfolgreich. PR18 wurde dadurch übernommen. Zuerst Pages, danach Worker umgestellt.

Worker-Editor mit dem geprüften 8019-Zeichen-Quelltext ersetzt, vollständig per Kopieren mit Git-Quelle verglichen (identisch), anschliessend Deploy ausgelöst. Die Erfolgsmeldung und neue aktive Worker-Version wurden wegen erneutem Stillstand der Browser-Verbindung noch nicht abgelesen. Eine Veröffentlichung wurde damit angestossen, ist aber noch nicht abschliessend bestätigt. Ein direkter CLI-Aufruf wurde durch Cloudflares vorgeschaltete Zugriffskontrolle mit 403/error1010 blockiert; dies ist KEIN Nachweis der neuen Nutzdatenprüfung. Kein weiterer Versuch zur Umgehung dieses Filters.

37 lokale Tests bestanden: zusätzlich vollständiger Durchlauf des Pages-Handlers über die echte SQL-Bestätigung zum Worker, erneutem Versuch ohne doppelte Weiterleitung, sowie Ablehnung manipulierter und abgelaufener Bestätigungen. Testcode in 9887ccaf3f6f9de87986a4ad7ccd3f8dbc08f421 gesichert.

Noch abzuschliessen: neue aktive Worker-Version im bestehenden Dashboard bestätigen, genau eine normale öffentliche Testanfrage mit Tabellenankunft prüfen und einen direkten unbestätigten Test im Cloudflare-HTTP-Tester abweisen lassen. Erst danach die zusätzliche Absicherung als vollständig live-verifiziert ausgeben. Bestehende Turnstile- und Kontingentfunktionen sowie deren vorheriger Live-Grenznachweis bleiben davon getrennt bestätigt.

## Abschlusskontrolle: aktive Worker-Version bestätigt

Am 2. November wurde im Cloudflare-Editor Version 87b8aa4d als Active/Latest abgelesen. Der Editor enthält 8019 Zeichen und meldet keine Probleme. Damit ist die zuvor offene Worker-Veröffentlichung bestätigt; main/automation/visibility-check-worker.js wurde mit der produktiven Quelle abgeglichen.

Die öffentliche Analyse von aimpact.ch wurde nach der Umstellung erneut abgeschlossen. Die letzte Formularprüfung wurde vor Eingabe der Testkontaktdaten automatisch gesperrt: Der dafür geöffnete Browser-Tab war inzwischen auf YouTube navigiert. Diese Seite gehört nicht zum autorisierten Auftrag und wurde nicht weiter bedient. Die Browser-Sicherheitsprüfung hat den Zugriff ausdrücklich automatisch abgelehnt. Kein neuer Formularerfolg und keine Tabellenankunft werden für diesen letzten Versuch behauptet.

Offen bleiben ausschliesslich der normale Formularversand nach Aktivierung der Nutzdatenbestätigung sowie ein aussagekräftiger direkter Negativtest im Cloudflare-HTTP-Tester. Dessen bisherige 403-Ausgabe ohne korrekt getrennte Header/Body ist kein Nachweis von Unauthorized intake. Die 37 automatisierten Tests einschliesslich des echten Handler-Durchlaufs und die vorherigen Live-Kontingenttests bleiben gültig. Für die nächsten UI-Schritte den Aimpact-Test-Tab reserviert lassen und nicht für andere Webseiten verwenden.

## Abgeschlossen am 2. November 2026: beide letzten Live-Prüfungen bestanden

- Normaler öffentlicher Versand nach Aktivierung der Nutzdatenbestätigung erfolgreich. Genau eine Zeile 12 in Tabellenblatt1: Aimpact Abschlusstest Autorisierung 02.11.2026, https://aimpact.ch/, Kategorien 99/95/100/100, Messzeit 2026-11-02T12:10:55.342Z, TBT140ms. H=Neu, I leer; keine automatische Gamma-Erstellung. Erfolgsmeldung im Browser bestätigt.
- Direkter Negativtest im Cloudflare-HTTP-Tester mit POST, getrennt verifizierten Headern Origin=https://aimpact.ch und Content-Type=application/json sowie gültigem synthetischem Lead, aber ohne D1-Bestätigung: Status403 und JSON {"error":"Unauthorized intake"}. Antwort vom aktiven Worker87b8aa4d, keine vorgeschaltete 1010-Sperre. Syntaxprüfung im Editor ohne Probleme.
- Danach A12:K15 erneut gelesen: ausschliesslich der reguläre Abschlusstest vorhanden, kein zusätzlicher Direkter-Sperrtest-Eintrag.
- Damit sind die früher ausdrücklich als offen dokumentierten Formular-/Sperrtests abgeschlossen. Gemeinsam mit dem vorher bestandenen echten Kontingenttest und 37 automatisierten Tests sind die beauftragten Schutzänderungen live verifiziert. Historische Zwischenstände bleiben als Verlauf erhalten; diese Abschlussbestätigung ist massgeblich.
- Limits bleiben vorsichtige feste UTC-Kontingente (Google50/Tag,4/Minute,3/Client je10Minuten; Make20/Monat,10/Tag,3/Minute). Reservierungen können bei späterer Ablehnung verbraucht werden. Kein Versprechen vollständiger Unangreifbarkeit oder kostenloser Gesamtnutzung. Nächste Projektaufgaben: Fehlerüberwachung, Funnel-Tracking und vorhandene KV-Unterlagen ergänzen.
