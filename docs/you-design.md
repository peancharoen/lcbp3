---
version: alpha
name: "You.com"
website: "https://you.com"
description: >-
  An AI-first answer engine whose API marketing page runs a three-band identity — deep brand-indigo at the top, ink-on-white in the middle, pure black at the bottom — with the same indigo voltage carried across every band as a single rounded pill CTA. Lumen Sans does every typographic tier at modest weights (400 body, 500 display); the 47px display headline sits in pure ink on the white middle band and inverts to pure white on the dark hero. The chromatic discipline is unusual for an AI-search brand: instead of holding the indigo for an accent dot or a chat-bubble glow, You ships it as a single saturated pill that survives surface inversion.
seo:
  title: "You.com Design System for React — indigo #5368ee, Lumen Sans, 14 components"
  metaDescription: "You.com's marketing system as a DESIGN.md file. Indigo #5368ee pill CTA, Lumen Sans across every tier, three-band layout (indigo / white / black). Tokens for React, Next.js, and AI coding tools."
  highlights:
    - "Three-band surface inversion — deep navy-indigo hero, ink-on-white middle, pure-black close; the brand pill survives every band"
    - "Single indigo pill — #5368ee carries the primary CTA at every position on the page, no second accent voltage"
    - "Lumen Sans across every tier — display at 47px / 500, body at 16px / 400, no separate display family"
    - "Mono caption strip — 14px monospace runs throughout the code snippets, the only secondary typographic voice"
    - "Generous-soft 16px radius — cards round at 16px, pill CTAs go fully rounded, no 4px tight tier anywhere"
  tags:
    - "AI & LLM Platforms"
  lastUpdated: "2026-05-19"
  author:
    name: "Dov Azencot"
    url: "https://x.com/dovazencot"
  opening: |
    You.com's marketing page does something rare for an AI-search brand: it shows the indigo voltage on three different floors of the page without flinching. The top band is a deep navy-indigo hero with a featured 87.29% stat-card and a violet pill announcing the Finance Research API; the middle band switches to pure white with a 47px Lumen Sans headline in ink and the same indigo pill rendered as the only chromatic CTA; the bottom band goes pure black, with the indigo pill returning yet again above the footer. Most peer search brands (Perplexity, Brave) keep their accent locked to one surface — You inverts the canvas under it and asks the pill to do the work alone.

    The DESIGN.md file packages the system into a machine-readable spec for React tooling. Inside: 17 color tokens drawn from a single indigo brand voltage, an ink-near-black running-text color, a near-white body canvas, and a small set of structural grays; 9 typography tokens running Lumen Sans (You's proprietary geometric sans) at weights 400 and 500 across every tier from 47px display to 12px metadata; 5 radius tokens centered on a 16px default plus a full-pill option; 8 spacing values on a 4px base; and 14 component definitions covering the indigo pill, the ink-on-white display heading, the deep-indigo hero card, the dark scene panel, and the mono code-strip caption.

    Feed this file to an AI coding tool and it reproduces You's specific moves: indigo as a single saturated pill voltage rather than as a UI accent, three-band canvas inversion (indigo hero / white body / black close), Lumen Sans at modest weights instead of bold display, 16px default rounding rather than tight 4px corners, and monospace as the only second voice. The move worth borrowing only if your product has a single confident brand color: trust one pill to do the entire CTA job across every surface — the inversion under it does more work than a second accent ever would.
  related:
    - href: "/design"
      title: "Browse all design systems"
      description: "The full directory of DESIGN.md files on shadcn.io, with live mockups for each."
    - href: "https://you.com"
      title: "You.com — official site"
      description: "You.com's public marketing site — the source of truth for the live tokens captured in this file."
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files — the format this page is built on."
  questions:
    - id: "primary-color"
      title: "What is You.com's primary brand color?"
      answer: "You's brand voltage is indigo #5368ee — a saturated, slightly-cool blue wired into CSS as --swatch--brand-500, --_theme---button-primary--background, and --_theme---text--text-accent. It carries the primary pill CTA on every band of the page, including the deep navy-indigo hero, the white middle section, and the pure-black close above the footer. There is no second brand accent: the violet and cherry families declared in the swatch palette appear only in product-side decoration like the announcement chip and the gradient washes behind code panels."
    - id: "typography"
      title: "What typeface does You.com use, and what should I use as a substitute?"
      answer: "You.com runs Lumen Sans for every spoken surface — display, heading, body, button, and nav. It is a proprietary geometric sans loaded with Arial as the fallback. Display headlines sit at 47px in weight 500, smaller display at 37px / 500, body at 16px / 400, captions at 12px / 400, and nav links at 16px / 400. There is no 700 weight on the captured page. The closest open-source substitutes are Inter or Geist at the same weights; both match Lumen Sans's geometric proportions at 16-19px body sizes. For the mono caption strip use JetBrains Mono."
    - id: "three-band-layout"
      title: "Why does You.com invert its background three times on one page?"
      answer: "The page is structured as three vertical bands stacked top-to-bottom: a deep navy-indigo hero (#1a1f4d-ish surface) carrying the Finance Research API announcement and the 87.29% featured stat; a pure-white editorial body running the headline, sub-paragraph, customer logo wall, and feature cells; and a pure-black close section pairing a dark scene panel with a final repeat of the indigo pill above the footer. The inversion isn't decoration — it lets the same indigo pill act as the anchor across three different surface conventions, which is You's structural way of saying the product moves between dark search results and light editorial chrome without breaking identity."
    - id: "radius-and-pills"
      title: "What corner-radius scale does You.com use?"
      answer: "The system runs a generous-soft scale anchored at 16px. Cards default to 16px, internal chips at 12px, smaller buttons at 8px, and the primary CTA goes fully pill at the maximum representable radius. There is no 4px tight tier — even the smallest interactive surfaces start at 8px. The pill treatment is reserved for the indigo CTA and the announcement chip; everything else uses the rounded-rectangle 12-16px scale. The result keeps every interactive element feeling tappable rather than industrial, which matches the consumer-search positioning."
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to build my own AI-search marketing site?"
      answer: "Yes — the file is structured to be fed into Claude, Cursor, or any AI tool that reads structured design tokens. The agent will reproduce You's specific moves: three-band canvas inversion (indigo / white / black), a single indigo pill voltage at #5368ee carried across every band, Lumen Sans-equivalent typography at modest weights, monospace caption strips inside code blocks, and 16px default rounding with a full-pill primary. The tokens resolve without invention — every hex, font family, radius, and spacing value is a quoted scalar ready to drop into Tailwind or CSS variables. The borrowable move is the band inversion under a single brand pill; the harder discipline is keeping the indigo from leaking into secondary chrome."

mockups:
  - "marketing-hero"
  - "chat-conversation"

colors:
  primary: "#5368ee"
  primary-hover: "#4757c9"
  primary-soft: "#5061d5"
  accent-violet: "#7928a1"
  accent-amber: "#aa5d00"
  success: "#008000"
  error: "#f04438"
  ink: "#121212"
  ink-soft: "#242426"
  ink-muted: "#5e5f6b"
  muted: "#545454"
  canvas: "#ffffff"
  surface-1: "#f2f2f2"
  surface-dark: "#000000"
  hairline: "#d9d9de"
  hairline-soft: "#cdced6"
  chip-violet: "#e0dbf9"

typography:
  display-xl:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 47px
    fontWeight: 500
    lineHeight: 56px
    letterSpacing: 0
  display-md:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 37px
    fontWeight: 500
    lineHeight: 48px
    letterSpacing: 0
  heading-md:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 29px
    fontWeight: 500
    lineHeight: 38px
    letterSpacing: 0
  heading-sm:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 30px
    letterSpacing: 0
  body-lg:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 30px
    letterSpacing: 0
  body-md:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0
  body-sm:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 21px
    letterSpacing: 0
  label-md:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0
  caption:
    fontFamily: "\"Lumen Sans\", Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0.3px
  mono-sm:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 21px
    letterSpacing: 0

rounded:
  none: "0px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.canvas}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
    height: "36px"
    borderColor: "{colors.hairline}"
  top-nav:
    backgroundColor: "transparent"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    padding: "16px 24px"
    height: "64px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    padding: "8px 12px"
  hero-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "24px"
  hero-heading:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
  section-heading:
    backgroundColor: "transparent"
    textColor: "{colors.canvas}"
    typography: "{typography.display-xl}"
  body-paragraph:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  body-paragraph-muted:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-md}"
  card-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "24px"
    borderColor: "{colors.hairline}"
  chip-announcement:
    backgroundColor: "{colors.chip-violet}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    height: "28px"
  code-block:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.canvas}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.md}"
    padding: "16px"
  footer:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    padding: "48px 24px"
---

## Overview

You.com's marketing page does something unusual for an AI-search brand: it inverts the canvas under its CTA three times in a single scroll. **Voltage-across-bands.** The top band is a deep navy-indigo hero carrying an announcement chip and a featured 87.29% stat card; the middle band switches to a near-white canvas with a 47px Lumen Sans headline in ink black; the bottom band goes pure `{colors.surface-dark}` (#000000), repeating the indigo pill once more above the footer. Where Perplexity locks its accent to a single dark canvas and Brave keeps the orange pinned to one CTA, You ships the same `{colors.primary}` (#5368ee) pill at every position on the page and lets the surface beneath it change.

The chromatic restraint is uncompromising. Indigo `{colors.primary}` is the only saturated brand voltage on the page — it carries the primary CTA, the secondary text-accent on inline links, and the selection-text color. A small set of supporting hues (the violet `{colors.accent-violet}` inside the announcement chip text, the amber `{colors.accent-amber}` on inline status pills, the green `{colors.success}` and red `{colors.error}` for system status) appears in fewer than two dozen captured occurrences combined. Every other tone on the page is structural — ink, muted gray, hairline, canvas — so the eye reads only one brand color.

Typography is Lumen Sans across every spoken tier. The display caps at 47px in weight 500 with normal letter-spacing, the body sits at 16px in weight 400, and the system uses no 700 weight at all. The supporting voice is a system monospace stack carrying the code captions inside the API panels — the only place a second typeface family appears. Monospace appears 118 times across the captured surface (mostly inside code blocks); Lumen Sans variants account for everything else.

**Key Characteristics:**
- Single indigo voltage (`{colors.primary}` — #5368ee) carries the primary pill CTA across all three bands of the page — deep navy-indigo hero, white body, pure black close.
- Three-band canvas inversion (`{colors.surface-dark}` top hero variant / `{colors.canvas}` body / `{colors.surface-dark}` close) — the structural device that makes the single-voltage discipline visible.
- Lumen Sans across every tier; display at 47px / 500 is the loudest moment, with no weight above 500 anywhere on the page.
- Monospace caption strip carries every code sample (118 captured occurrences) — the only second typographic voice in the system.
- Generous-soft radius scale anchored at `{rounded.lg}` (16px), with full pill for the primary CTA and the announcement chip.
- Customer logo wall renders all marks in original color rather than flattening to monochrome — a softer treatment than the Cloudflare or Vercel convention.
- Hairline-only cards on the white body band, with `{colors.hairline}` (#d9d9de) as the dominant border tone; no shadow tier on the captured surface.
- 4px base spacing with 8px as the dominant rhythm; section padding runs ~96px on the hero and tightens to ~64px between body sections.

## Colors

### Brand

- **Indigo Primary** (`{colors.primary}` — #5368ee): frequency 11. Used as background (5), border (5), gradient (1). The single brand voltage — fills the primary CTA pill, the announcement chip background on the hero, the inline text-accent links, and the selection background. Wired in CSS as `--swatch--brand-500`, `--_theme---button-primary--background`, `--_theme---text--text-accent`, and `--_theme---selection--text`.
- **Indigo Hover** (`{colors.primary-hover}` — #4757c9): declared as `--_theme---button-primary--background-hover` and `--swatch--brand-700`. The press / hover state — one step darker than the primary, unused in the captured static render but reserved for the interactive state.
- **Indigo Soft** (`{colors.primary-soft}` — #5061d5): declared as `--swatch--brand-600`. A mid-tone between primary and hover; reserved for product-side accent layers.
- **Accent Violet** (`{colors.accent-violet}` — #7928a1): frequency 56 — text and border only. Used on the announcement-chip text ("The You.com Finance Research API is here") and on inline category tags inside code-snippet cards. Not part of the brand voltage; reads as a sibling color reserved for product-domain emphasis.
- **Accent Amber** (`{colors.accent-amber}` — #aa5d00): frequency 24. Used on inline status pills and badges that need to read as warm-priority without competing with the brand indigo.

### Status

- **Success** (`{colors.success}` — #008000): frequency 102 — text and border. Used on positive system-state indicators inside the API documentation panels and on the customer-logo strip captions.
- **Error** (`{colors.error}` — #f04438): declared as `--swatch--error`. Reserved for form validation; not rendered in the captured static surface.

### Surface

- **Canvas** (`{colors.canvas}` — #ffffff): frequency 319 — the dominant body floor below the hero. Carries the editorial middle band, the customer-logo wall, the feature cells, and the inside of every hairline-bordered card.
- **Surface-1** (`{colors.surface-1}` — #f2f2f2): frequency 23 — a soft gray used for inset surfaces inside cards and as the hover background on secondary buttons. Wired as `--swatch--light-2` and `--_theme---button-secondary--background`.
- **Surface Dark** (`{colors.surface-dark}` — #000000): frequency 5 — used as the page-close band beneath the white middle, the dark scene-panel surface, and the footer floor. The black surfaces frame the white body band on both ends of the scroll.

### Text

- **Ink** (`{colors.ink}` — #121212): frequency 356 — the dominant text color on the white body band. Wired as `--swatch--zinc-900`, `--swatch--brand-950`, `--_theme---text--text-primary`. Never pure black — slightly off so the display headline reads warm rather than industrial.
- **Ink Soft** (`{colors.ink-soft}` — #242426): a secondary ink tone used inside dropdown surfaces and small UI labels — wired as `--swatch--zinc-700` and `--swatch--grey-950`.
- **Ink Muted** (`{colors.ink-muted}` — #5e5f6b): frequency 73 — used for secondary running-text and caption rows. Wired as `--swatch--grey-600` and `--_theme---text--text-secondary`.
- **Muted** (`{colors.muted}` — #545454): frequency 270 — the dominant secondary text color, sitting between ink and ink-muted in tone. Wired as `--swatch--grey-700`.

### Hairline

- **Hairline** (`{colors.hairline}` — #d9d9de): frequency 5 — used as the default 1px border on cards, dropdowns, and input fields. Wired as `--swatch--grey-200`, `--swatch--zinc-200`, `--_theme---menu--stroke`.
- **Hairline Soft** (`{colors.hairline-soft}` — #cdced6): frequency 34 — a slightly cooler hairline used on the secondary-button hover state and on dropdown internal dividers.

### Decorative

- **Chip Violet** (`{colors.chip-violet}` — #e0dbf9): frequency 4 — the soft violet fill behind the announcement chip on the hero. Wired as `--swatch--brand-300` and `--swatch--cherry-200`.

## Typography

### Font Family

The system runs **Lumen Sans** — You's proprietary geometric sans — for every spoken surface. Fallbacks walk `Arial, sans-serif`. The supporting voice is a system **monospace stack** (`ui-monospace, SFMono-Regular, Consolas`) reserved for the code captions inside API-documentation panels. There is no serif tier and no display-specific family — one variable-weight sans does display, heading, body, button, and label work alike.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-xl}` | 47px | 500 | 56px | Hero h1 ("The Leading Web Search APIs for AI"), section h2 below the fold |
| `{typography.display-md}` | 37px | 500 | 48px | Smaller display, secondary section titles |
| `{typography.heading-md}` | 29px | 500 | 38px | h2 / h3 sub-section headings |
| `{typography.heading-sm}` | 20px | 500 | 30px | h3 / card titles |
| `{typography.body-lg}` | 20px | 400 | 30px | Hero sub-paragraph, lead-paragraph blocks |
| `{typography.body-md}` | 16px | 400 | 24px | Default running text, nav links |
| `{typography.body-sm}` | 14px | 400 | 21px | Caption rows, footnote text |
| `{typography.label-md}` | 16px | 500 | 16px | Button label, chip label, primary tab label |
| `{typography.caption}` | 12px | 400 | 18px | Metadata, tracked labels (0.3px letter-spacing) |
| `{typography.mono-sm}` | 14px | 400 | 21px | Code captions inside API documentation panels |

### Principles

Display weight stays at 500 across every size, from the 47px hero h1 down to 20px card titles. There is no 700 weight on the captured page — body and labels share 400, and 500 is the system's emphasis tier across both display and small-label surfaces. The 47px hero size is the loudest typographic moment; bumping to 700 would tip the editorial dek into a generic SaaS hero. Captions at 12px / 400 carry a slight 0.3px letter-spacing — the only tracked text in the system.

### Note on Font Substitutes

Lumen Sans is proprietary. **Inter** at the same weights is the closest open-source substitute; the geometric proportions transfer cleanly. **Geist** (Vercel's open-source sans) at weight 500 is a slightly tighter alternative for the 47px display tier. For the mono caption strip, **JetBrains Mono** or the system stack already declared in fallbacks both transfer at the same 14px size.

## Layout

### Spacing System

- **Base unit:** 4px, with 8px and 16px as the dominant gap rhythms.
- **Tokens:** `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.base}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.2xl}` 48px · `{spacing.3xl}` 64px.
- **Section padding (vertical):** ~96px on the hero band; below the fold the rhythm tightens to ~64px between sections.
- **Card internal padding:** `{spacing.lg}` (24px) on the API-panel cards, `{spacing.base}` (16px) on the smaller customer-logo chips.

### Grid & Container

- **Max content width:** ~1080px on the editorial body sections, ~1280px on the customer-logo wall and the dark scene panel.
- **Hero band:** dark navy-indigo full-bleed surface, content centered at ~720px max-width with the announcement chip and 87.29% stat card stacked beside the headline.
- **Middle band:** white canvas, centered ~1080px column; the headline / sub-paragraph / CTA stack runs single-column, with customer logos flowing in a single uniform-height row beneath.
- **Code-panel section:** 2-column 50/50 grid pairing an API-description column with a syntax-highlighted code block on the right.
- **Bottom band:** pure black scene panel, content centered at ~720px with the same indigo pill repeated above the footer.

### Rhythm

The page alternates between **three structural bands** — dark hero / light body / dark close — rather than holding a single tempo. The hero is dense (chip + stat + headline + CTA). The body is generous (single-column editorial, ample whitespace between sections). The close is dense again (paired scene panel + CTA pill). The inversion is the page's structural device — every section is unambiguously assigned to one of the three bands.

## Elevation

The system has essentially **no shadow tier** on the captured surfaces. Cards on the white body band use 1px `{colors.hairline}` (#d9d9de) outlines and zero shadow; the dark scene panel on the bottom band reads as elevated purely by tonal contrast against the pure-black floor. Dropdown menus carry a subtle `rgba(0,0,0,0.04)` halo but the value is faint enough to read as a hairline at most viewing sizes.

- **Flat (no shadow):** hero, body bands, feature cells, footer — 99% of surfaces.
- **Tonal lift:** the indigo CTA pill sits with a barely-perceptible 1-pixel shadow on the white body band; the dark scene panel on the close band lifts off `{colors.surface-dark}` by ~10 points of lightness.
- **Hairline outlines:** `{colors.hairline}` carries the elevation work that shadows would carry on a typical dashboard product.

## Shapes

The radius scale is **generous-soft** with a full-pill option:

- `{rounded.none}` 0px — only on code-block annotations.
- `{rounded.sm}` 8px — small UI surfaces (dropdown items, input field corners).
- `{rounded.md}` 12px — secondary chips and internal card sub-surfaces.
- `{rounded.lg}` 16px — default card rounding, the dark scene panel, the API-documentation panels.
- `{rounded.xl}` 24px — larger feature surfaces.
- `{rounded.full}` 9999px — the primary CTA pill (`{component.button-primary}`), the announcement chip (`{component.chip-announcement}`), and circular icon buttons.

There is no 4px tier. Even the smallest interactive surfaces start at 8px. The pill treatment is reserved for two surfaces — the primary CTA and the announcement chip — both of which carry the brand voltage at one stop or another on the page.

## Components

**`button-primary`** — The signature CTA. Indigo `{colors.primary}` fill, white text, fully-rounded `{rounded.full}` pill, 8x16px padding, 36px height, weight 500. "Try the APIs for free" is the canonical instance, repeated three times on the page — once per band.

**`button-primary-hover`** — Background flips to `{colors.primary-hover}` (#4757c9) — one step darker — on press. White text remains.

**`button-secondary`** — White `{colors.canvas}` fill, ink text, 1px hairline border, fully-rounded `{rounded.full}` pill, 8x16px padding, 36px height. Used for "Contact Sales" and "Explore API Docs" tertiary actions across the page.

**`top-nav`** — Transparent surface that sits over the dark hero band — Lumen Sans white text, 16x24px padding, 64px height. Houses the You.com wordmark flush left, the product-nav links (Product / Customers / You / Pricing / Benchmarks / Blog) center, and the Sign In / Contact Sales cluster flush right.

**`nav-link`** — Transparent background, white text at `{typography.body-md}` (16px / 400), 8x12px padding. No visible hover background in the captured static render.

**`hero-card`** — Dark `{colors.surface-dark}` fill, white text, `{rounded.lg}` 16px radius, 24px padding. The 87.29% featured stat card on the dark hero band sits inside this treatment.

**`hero-heading`** — Ink `{colors.ink}` text on the white middle band, Lumen Sans 47px / 500. The h1 inverts to white when it appears on the dark hero band but keeps the same size and weight token.

**`section-heading`** — White text on the dark sections, same `{typography.display-xl}` token. The bottom-band h2 ("Start Building With You.com Web Search APIs for AI") uses this treatment.

**`body-paragraph`** — Default ink running-text at `{typography.body-md}` — the workhorse paragraph style on the white body band.

**`body-paragraph-muted`** — `{colors.muted}` (#545454) variant for secondary copy and caption rows.

**`card-light`** — White `{colors.canvas}` surface, 1px `{colors.hairline}` border, `{rounded.lg}` 16px radius, 24px internal padding. The default content card on the white body band — holds feature explanations and customer quotes.

**`chip-announcement`** — Soft violet `{colors.chip-violet}` (#e0dbf9) fill on the hero band, ink text, fully-rounded `{rounded.full}` pill, 4x12px padding, 28px height. Carries the "Finance Research API" announcement copy in the upper-left of the hero.

**`code-block`** — Black `{colors.surface-dark}` fill, white text, `{rounded.md}` 12px radius, 16px padding. Uses `{typography.mono-sm}` (14px / 400) for the embedded API code samples.

**`footer`** — Black `{colors.surface-dark}` floor, muted-gray text at `{typography.body-sm}`, 48x24px padding. Continues the bottom-band canvas without a surface break.

## Do's and Don'ts

**Do** carry the indigo `{colors.primary}` pill across all three bands of the page — dark hero, white body, dark close. The system's single chromatic discipline is that one pill anchors every band; collapsing it onto a single band would lose the surface-inversion structural device.

**Do** use `{colors.canvas}` (#ffffff) for the middle band and `{colors.surface-dark}` (#000000) for the top and bottom bands. A neutral gray for either floor would mute the band inversion that frames the editorial body.

**Do** keep Lumen Sans display weight at 500 across every size from 47px down to 20px. Bumping to 700 turns the editorial dek into a generic SaaS hero and undercuts the magazine-style restraint.

**Do** reserve the mono-caption stack for code samples inside API-documentation panels. Using mono for headings, body, or nav would break the only meaningful typographic split in the system.

**Don't** introduce a second saturated brand color alongside indigo `{colors.primary}`. The violet, amber, green, and red tones in the swatch palette are scoped to status indicators, announcement chips, and code-snippet category tags — putting any of them on a primary CTA would create two competing brand voltages.

**Don't** flatten the customer-logo wall to monochrome. You renders customer marks in their original brand colors at uniform height — the multi-color treatment is intentional and signals openness rather than the single-voltage discipline of a Cloudflare-style logo wall.

**Don't** introduce a 4px corner-radius tier. The system is deliberately generous-soft starting at 8px; adding tight corners would feel borrowed from a dev-tools system (Vercel, Linear) rather than from a consumer-search product.

**Don't** drop the indigo pill on the white middle band in favor of an ink-on-white button. The pill must keep its brand voltage on every band, and inverting it on the white surface would lose the cross-band anchor that the entire layout depends on.

## Known Gaps

- **Dark / light mode pairing:** the page captures a single fixed sequence of dark-hero / light-body / dark-close bands rather than a toggleable theme. The product itself (the chat interface) carries a full dark-mode token set not represented here.
- **Hover and focus states:** documented for `{component.button-primary-hover}` only; the full state matrix (focus rings, disabled tints, error tokens) is declared in the CSS swatch palette but not rendered on the captured surface.
- **Form input states:** the captured page has no surface-rendered text input — the search bar and sign-in fields live behind interaction and are not visible in the static capture.
- **Motion:** the dark scene panel above the footer carries a subtle particle / line-art animation in the live page, but the spec captures end-state values only. Easing curves and motion timing live in the runtime.
- **Product surfaces:** this DESIGN.md captures the public marketing page only. The You.com chat interface (`you.com/?q=`) and the agentic search interface carry a much richer dark-mode token set — chat bubbles, citation tags, source thumbnails, model picker — that is not represented here.
- **Subscription tier accents:** the `{colors.accent-violet}` and `{colors.accent-amber}` carry rare badge / chip rendering on the marketing page but their primary use is product-side (subscription tier labels, status flags) and is not exposed in the captured marketing chrome.
