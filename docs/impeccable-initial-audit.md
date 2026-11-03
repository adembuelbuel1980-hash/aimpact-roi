# Aimpact — Initial design critique and implementation backlog

Assessment scope: repository `index.html` and publicly rendered text of https://aimpact.ch/, 2026-11-03. This is a manual preliminary review **not** an executed Impeccable CLI audit or browser screenshot test.

## P1: Conversion hierarchy
Header gives the technical Website-Check the filled primary button while the hero's personal Maps-Check is positioned as the main conversion. Align header label / destination to the primary `#maps-anfrage`; move self-service check to a secondary link. Verify in mobile menu.

## P1: Unnecessary repeated content
The sections headed “Einfach. Klar. Messbar.” and “Dein Ansprechpartner: Adem Bülbül” both have near-identical three-step content. Keep the first process and compress the second into a compact credibility statement, preserving the truthful no-guarantees message.

## P1: Large embedded image
Founder photo in `index.html` is an inline base64 JPEG data URL. Extract to an optimised image asset if safe; use width, height, responsive dimensions and decoding/loading controls. Compare before/after total transferred size and LCP.

## P2: Form clarity
Email and phone are presented as optional alternatives; HTML initially marks email `required`, then JavaScript removes that attribute. Align static HTML and no-JavaScript fallback with the stated contact rule. Verify inline validation, consent and Formspree success/error behaviour without generating test leads in production.

## P2: Typography and design consistency
Use a consistent spacing scale and type hierarchy. Confirm readable text contrast on gold, dark cards, light section secondary copy and small eyebrow labels.

## P2: Mobile / accessibility
Test at 320, 375, 768, 1024 and 1440 CSS px. Verify nav open/close, accessible names, focus order, Escape key behavior, touch targets, no horizontal overflow, anchor offsets, reduced motion.

## P2: Measurement
Check whether primary Maps-Check form success and secondary self-service check are separately tracked, without logging personal data. Do not claim lead events are firing until verified.

## P3: Micro-interactions
After core issues are solved, add restrained hover and state transitions while preserving reduced-motion support.

## Implementation sequence
1. Run `npx impeccable install` in a clean local checkout or trusted coding workspace. Review generated files/hooks before accepting.
2. Reload supported agent, run `/impeccable init` (or `$impeccable init` in Codex), reconcile generated PRODUCT.md with this documented product context.
3. Run `/impeccable document`, preserve the palette and review generated DESIGN.md.
4. Run focused `critique` on hero, navigation and form; `audit` against local rendered page.
5. Implement P1 changes in small isolated commits and review diff/screenshots.
6. Run `npx impeccable detect <local-preview-url>` (rendered page), performance and form checks. Keep production unchanged until explicitly approved.
