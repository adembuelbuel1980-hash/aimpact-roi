#!/usr/bin/env python3
"""Dependency-free guardrails for Aimpact's static landing page.

These are static smoke checks, not rendered-browser or end-to-end tests.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


class ElementCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def check(name, condition):
    print(f"{'PASS' if condition else 'FAIL'}: {name}")
    return bool(condition)


def main():
    root = Path(__file__).resolve().parents[1]
    html_path = root / "index.html"
    html = html_path.read_text(encoding="utf-8")
    parser = ElementCollector()
    parser.feed(html)
    elements = parser.tags

    def find(tag, key, value):
        return [attrs for t, attrs in elements if t == tag and attrs.get(key) == value]

    anchor_targets = {a.get("id") for _, a in elements if a.get("id")}
    nav = find("nav", "id", "navLinks")
    primary_links = [
        attrs for tag, attrs in elements
        if tag == "a" and "btn-primary" in attrs.get("class", "").split()
    ]
    form = find("form", "id", "maps-request-form")
    email = find("input", "id", "maps-email")
    phone = find("input", "id", "maps-phone")
    consent = find("input", "name", "datenschutz")

    checks = [
        ("German Swiss language", bool(find("html", "lang", "de-CH"))),
        ("Document title", bool(re.search(r"<title>[^<]+</title>", html))),
        ("Navigation present", bool(nav)),
        ("Primary Maps CTA targets real section", any(a.get("href") == "#maps-anfrage" for a in primary_links) and "maps-anfrage" in anchor_targets),
        ("Secondary website check available", any(t == "a" and a.get("href") == "https://check.aimpact.ch/website-check" for t, a in elements)),
        ("Maps contact form present", len(form) == 1),
        ("Formspree target unchanged", bool(form) and form[0].get("action") == "https://formspree.io/f/mqeoqqgo"),
        ("Contact email and phone alternatives", bool(email and phone) and "required" not in email[0] and "required" not in phone[0]),
        ("Consent remains required", bool(consent) and "required" in consent[0]),
        ("Privacy policy still linked", any(t == "a" and a.get("href") == "datenschutz.html" for t, a in elements)),
        ("Analytics ID remains in place", "G-FJJD9PCMZ3" in html),
        ("Confirmed success precedes lead event", 0 <= html.find("if (!response.ok || data.ok !== true)") < html.find("window.gtag('event', 'generate_lead'")),
        ("No personal data in event payload", bool(re.search(r"gtag\('event', 'generate_lead',\s*\{\s*lead_source: 'personal_maps_check'\s*\}\)", html))),
        ("Assistant script preserved", any(t == "script" and a.get("src", "").startswith("aimpact-assistant.js") for t, a in elements)),
        ("Services and offer remain", "leistungen" in anchor_targets and "angebot" in anchor_targets and "CHF 2’490" in html),
        ("Mobile menu Escape support", "event.key === 'Escape'" in html),
    ]
    result = [check(name, status) for name, status in checks]
    print(f"\n{sum(result)}/{len(result)} static checks passed.")
    return 0 if all(result) else 1


if __name__ == "__main__":
    sys.exit(main())
