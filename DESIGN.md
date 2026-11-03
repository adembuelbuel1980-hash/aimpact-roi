# Aimpact — Design system (current source baseline)

Documented from the existing index.html; these are starting constraints, not a claim that Impeccable has generated a design.

## Brand tokens
- Background: `#0a0a0a`
- Surface: `#111111`
- Foreground: `#f6f4ee`
- Light section: `#f6f4ee`
- Light paper alternative: `#ece9df`
- Accent gold: `#c9a84c`
- Muted: `#a7a39a`
- Content max-width: `1180px`
- Card radius: `18px`

## Typography
Current stack: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. Body 16px, line-height 1.65. Main H1 uses clamp(2.8rem, 6.1vw, 5.5rem), H2 clamp(2rem, 3.8vw, 3.45rem). Prefer clear hierarchy rather than decorative type.

## Layout / components
- Dark sticky top navigation, gold primary action, dark outlined secondary actions.
- Broad editorial sections; use white sections to break the dark canvas.
- Bordered cards, three-step process, FAQ details/summary, founder image.
- Breakpoints currently at 900px, 720px, 600px, plus 899px.
- Native HTML landing page with inline CSS and small JavaScript handlers.

## Interaction rules
- One primary conversion goal: personal Maps check; technical website check is a text-link alternative.
- Visible focus outlines; minimum 44px touch targets where practical.
- Respect `prefers-reduced-motion: reduce`; animations should be subtle and never block content.
- Mobile layout must avoid text overflow and horizontal scrolling.
- Form must announce submission state, preserve input on failure and work with keyboard access.

## Do not
- Introduce generic purple-blue gradients, decorative icon grids, ornamental glassmorphism, excessive card nesting, intrusive popups or animations.
- Replace proof with invented testimonials, case studies, business metrics or AI visibility guarantees.
