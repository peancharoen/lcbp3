---
version: 1.0.0
name: "NAP-DMS (LCBP3)"
website: "https://git.np-dms.work/np-dms/lcbp3"
description: >-
  An enterprise Document Management System for construction project document control.
  The design system runs on shadcn/ui with HSL CSS variables, Inter as the sole sans-serif
  family, and a dual-theme (light/dark) surface system with dark mode as the default.
  The primary brand voltage is a deep blue (HSL 220 78% 34% in light, 207 92% 63% in dark)
  that carries the primary CTA, focus rings, and chart accents. Unlike consumer-facing
  AI brands that hold a single accent, NAP-DMS requires a multi-status color matrix —
  green for approved, red for rejected, yellow for pending, blue for in-review, amber
  for draft — because workflow state visibility is the core UX problem. The radius scale
  is anchored at 8px (shadcn/ui default), with 6px and 4px steps for tighter surfaces.
  Elevation is explicit: cards use 1px hairline borders in light mode and tonal contrast
  in dark mode, with shadow utilities reserved for popovers and dropdowns only.
seo:
  title: "NAP-DMS Design System — shadcn/ui, Inter, HSL tokens, workflow status colors"
  metaDescription: >-
    NAP-DMS (LCBP3) design system as a DESIGN.md file. shadcn/ui with HSL CSS variables,
    Inter font, dual-theme (light/dark with dark default), 8px radius, workflow status
    color matrix (green/red/yellow/blue/amber), 16 component definitions for React/Next.js.
  highlights:
    - "Dual-theme HSL tokens — dark mode default, light mode optional, all colors as HSL CSS variables consumed by Tailwind"
    - "Workflow status matrix — green (approved), red (rejected), yellow (pending), blue (in-review), amber (draft) — the core UX problem for DMS"
    - "Inter as sole sans-serif — no display family, no monospace in UI chrome, weight range 400-700"
    - "shadcn/ui 8px radius default — 6px and 4px steps for tighter surfaces, no pill tier"
    - "Hairline elevation — 1px borders in light mode, tonal contrast in dark mode, shadows reserved for floating surfaces only"
    - "Data-dense layout — 12-column grid, 24px section gaps, 16px card padding, optimized for document lists and detail views"
  tags:
    - "Enterprise DMS"
    - "Construction Document Control"
    - "shadcn/ui"
    - "Next.js"
  lastUpdated: "2026-07-27"
  author:
    name: "NAP-DMS Team"
    url: "https://git.np-dms.work/np-dms/lcbp3"
  opening: |
    NAP-DMS (LCBP3) is an enterprise Document Management System for construction project
    document control — RFA, Transmittal, Correspondence, Circulation. The design system
    is built on shadcn/ui with HSL CSS variables, giving every color token a dual-theme
    representation (light and dark) that toggles via a class attribute. Dark mode is the
    default; light mode is the alternative. The primary brand voltage is a deep blue that
    shifts between HSL 220 78% 34% (light) and 207 92% 63% (dark) — the same hue family
    at different lightness steps, not two different colors.

    The DESIGN.md file packages the system into a machine-readable spec for AI tooling.
    Inside: 24 color tokens drawn from the shadcn/ui HSL variable set, covering brand
    primary, secondary, destructive, muted, accent, border, chart, and a 5-color workflow
    status matrix; 8 typography tokens running Inter at weights 400-700 across every tier
    from 36px display to 12px caption; 4 radius tokens anchored at 8px; 8 spacing values
    on a 4px base; and 16 component definitions covering the workflow banner, status badge,
    document card, data table, file upload zone, and AI chat panel.

    Feed this file to an AI coding tool and it reproduces NAP-DMS's specific moves:
    dual-theme HSL tokens with dark-mode default, a workflow status color matrix that
    maps document lifecycle states to semantic colors, shadcn/ui 8px radius discipline,
    hairline-only elevation for cards with shadow reserved for floating surfaces, and
    Inter at modest weights for data-dense interfaces. The borrowable move is the workflow
    status matrix — five colors that map to the five document lifecycle states, each
    carrying enough chromatic distance to be distinguishable in a dense list view.
  related:
    - href: "/docs/you-design.md"
      title: "You.com DESIGN.md — format reference"
      description: "The DESIGN.md format used as structural template for this file."
    - href: "https://ui.shadcn.com"
      title: "shadcn/ui — component library"
      description: "The base component library powering NAP-DMS frontend."
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files."
  questions:
    - id: "primary-color"
      title: "What is NAP-DMS's primary brand color?"
      answer: >-
        The primary brand voltage is a deep blue — HSL 220 78% 34% in light mode
        (approximately #1e3a8a) and HSL 207 92% 63% in dark mode (approximately #38bdf8).
        Both values are wired as --primary in the CSS variable set and consumed by
        Tailwind as hsl(var(--primary)). The primary carries the default button background,
        focus ring, active nav indicator, and chart-1 accent. In dark mode the primary
        shifts to a brighter, more saturated blue to maintain contrast against the dark
        navy background (HSL 221 67% 10%).
    - id: "workflow-status-colors"
      title: "How does NAP-DMS handle workflow status colors?"
      answer: >-
        The system defines a 5-color workflow status matrix: green (#22c55e) for
        APPROVED/COMPLETED/ISSUED, red (#ef4444) for REJECTED/CANCELLED, yellow (#eab308)
        for PENDING, blue (#3b82f6) for IN_REVIEW, and amber (#f59e0b) for DRAFT and
        default/unknown states. These colors are applied via Tailwind utility classes
        (bg-green-500, bg-red-500, etc.) on Badge components, not through CSS variables —
        they are semantic status indicators, not theme tokens. The matrix is designed for
        at-a-glance scanning in dense document list views where 20-50 documents may be
        visible simultaneously.
    - id: "dark-mode-default"
      title: "Why is dark mode the default theme?"
      answer: >-
        NAP-DMS users — document controllers, engineers, project managers — work in
        extended sessions reviewing large document sets. Dark mode reduces eye strain
        during prolonged use and provides better contrast for document thumbnails and
        preview images. The theme provider (next-themes) sets defaultTheme="dark" with
        enableSystem={false}, meaning the user must explicitly switch to light mode.
        Both themes share the same component structure; only the HSL variable values
        change.
    - id: "radius-scale"
      title: "What corner-radius scale does NAP-DMS use?"
      answer: >-
        The system uses shadcn/ui's default 8px radius scale. --radius is set to 0.5rem
        (8px), with borderRadius.lg = var(--radius) = 8px, borderRadius.md = 6px
        (calc(var(--radius) - 2px)), and borderRadius.sm = 4px (calc(var(--radius) - 4px)).
        There is no full-pill tier — even primary buttons use rounded-lg (8px), not
        fully-rounded. The 8px default matches shadcn/ui's "default" style and keeps
        the interface feeling professional rather than consumer-playful.
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to generate NAP-DMS screens?"
      answer: >-
        Yes — the file is structured to be fed into Claude, Cursor, Stitch MCP, or any
        AI tool that reads structured design tokens. The agent will reproduce NAP-DMS's
        specific moves: dual-theme HSL tokens with dark-mode default, a 5-color workflow
        status matrix, shadcn/ui 8px radius, hairline elevation for cards, Inter at
        weights 400-700, and data-dense layouts optimized for document management. The
        tokens resolve without invention — every HSL value, font family, radius, and
        spacing value is a quoted scalar ready to drop into Tailwind or CSS variables.

mockups:
  - "document-list-view"
  - "document-detail-with-workflow-banner"
  - "ai-chat-side-panel"

colors:
  # ── Brand (shadcn/ui HSL variables) ──
  primary-light: "220 78% 34%"
  primary-dark: "207 92% 63%"
  primary-foreground-light: "210 40% 98%"
  primary-foreground-dark: "222 70% 12%"
  primary-hover-light: "220 78% 28%"

  # ── Secondary ──
  secondary-light: "214 35% 94%"
  secondary-dark: "221 42% 20%"
  secondary-foreground-light: "224 46% 14%"
  secondary-foreground-dark: "214 50% 94%"

  # ── Destructive ──
  destructive-light: "0 84% 60%"
  destructive-dark: "0 63% 31%"
  destructive-foreground: "210 40% 98%"

  # ── Muted ──
  muted-light: "214 35% 94%"
  muted-dark: "221 38% 18%"
  muted-foreground-light: "219 20% 42%"
  muted-foreground-dark: "214 23% 72%"

  # ── Accent ──
  accent-light: "213 95% 93%"
  accent-dark: "217 53% 26%"
  accent-foreground-light: "222 60% 24%"
  accent-foreground-dark: "214 50% 94%"

  # ── Surface ──
  background-light: "210 40% 99%"
  background-dark: "221 67% 10%"
  foreground-light: "224 46% 14%"
  foreground-dark: "214 50% 94%"
  card-light: "0 0% 100%"
  card-dark: "221 62% 13%"
  card-foreground-light: "224 46% 14%"
  card-foreground-dark: "214 50% 94%"
  popover-light: "0 0% 100%"
  popover-dark: "221 62% 13%"
  popover-foreground-light: "224 46% 14%"
  popover-foreground-dark: "214 50% 94%"

  # ── Border & Input ──
  border-light: "214 31% 89%"
  border-dark: "219 36% 24%"
  input-light: "214 31% 89%"
  input-dark: "219 36% 24%"
  ring-light: "220 78% 40%"
  ring-dark: "207 92% 63%"

  # ── Chart ──
  chart-1-light: "220 70% 48%"
  chart-1-dark: "207 92% 63%"
  chart-2-light: "200 80% 45%"
  chart-2-dark: "188 85% 52%"
  chart-3-light: "250 74% 60%"
  chart-3-dark: "250 90% 70%"
  chart-4-light: "174 60% 40%"
  chart-4-dark: "162 64% 50%"
  chart-5-light: "30 85% 55%"
  chart-5-dark: "31 95% 62%"

  # ── Workflow Status Matrix (Tailwind utility colors, not CSS variables) ──
  status-approved: "#22c55e"
  status-rejected: "#ef4444"
  status-pending: "#eab308"
  status-in-review: "#3b82f6"
  status-draft: "#f59e0b"

  # ── Priority Matrix ──
  priority-urgent: "#dc2626"
  priority-high: "#f97316"
  priority-medium: "#eab308"
  priority-low: "#16a34a"

typography:
  display-xl:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: "-0.02em"
  heading-md:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: "-0.01em"
  heading-sm:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: 0
  body-lg:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0
  body-md:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0
  body-sm:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 21px
    letterSpacing: 0
  label-md:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0
  caption:
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0

rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"

spacing:
  xs: "4px"
  sm: "8px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
  section: "96px"

components:
  button-primary:
    backgroundColor: "hsl(var(--primary))"
    textColor: "hsl(var(--primary-foreground))"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
    fontWeight: 500
  button-primary-hover:
    backgroundColor: "hsl(var(--primary))"
    textColor: "hsl(var(--primary-foreground))"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
    opacity: 0.9
  button-secondary:
    backgroundColor: "hsl(var(--secondary))"
    textColor: "hsl(var(--secondary-foreground))"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "hsl(var(--destructive))"
    textColor: "hsl(var(--destructive-foreground))"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "hsl(var(--foreground))"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
  top-nav:
    backgroundColor: "hsl(var(--background))"
    textColor: "hsl(var(--foreground))"
    typography: "{typography.body-sm}"
    padding: "0 24px"
    height: "56px"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "hsl(var(--muted-foreground))"
    typography: "{typography.body-sm}"
    padding: "8px 12px"
    activeTextColor: "hsl(var(--foreground))"
    activeFontWeight: 500
  card:
    backgroundColor: "hsl(var(--card))"
    textColor: "hsl(var(--card-foreground))"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "24px"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
  card-header:
    backgroundColor: "transparent"
    textColor: "hsl(var(--card-foreground))"
    typography: "{typography.heading-sm}"
    padding: "0 0 16px 0"
  status-badge:
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    height: "20px"
    fontWeight: 500
    textTransform: "uppercase"
  status-badge-approved:
    backgroundColor: "{colors.status-approved}"
    textColor: "#ffffff"
  status-badge-rejected:
    backgroundColor: "{colors.status-rejected}"
    textColor: "#ffffff"
  status-badge-pending:
    backgroundColor: "{colors.status-pending}"
    textColor: "#ffffff"
  status-badge-in-review:
    backgroundColor: "{colors.status-in-review}"
    textColor: "#ffffff"
  status-badge-draft:
    backgroundColor: "hsl(var(--secondary))"
    textColor: "hsl(var(--secondary-foreground))"
  workflow-banner:
    backgroundColor: "hsl(var(--card))"
    textColor: "hsl(var(--card-foreground))"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "16px 24px"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
  data-table:
    backgroundColor: "hsl(var(--card))"
    textColor: "hsl(var(--card-foreground))"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
    rowHeight: "48px"
    headerHeight: "40px"
    headerBackgroundColor: "hsl(var(--muted))"
    headerFontWeight: 500
  file-upload-zone:
    backgroundColor: "hsl(var(--muted))"
    textColor: "hsl(var(--muted-foreground))"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "32px"
    borderColor: "hsl(var(--border))"
    borderWidth: "2px"
    borderStyle: "dashed"
  ai-chat-panel:
    backgroundColor: "hsl(var(--card))"
    textColor: "hsl(var(--card-foreground))"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "16px"
    width: "400px"
  input-field:
    backgroundColor: "hsl(var(--background))"
    textColor: "hsl(var(--foreground))"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
    borderColor: "hsl(var(--input))"
    borderWidth: "1px"
    focusRingColor: "hsl(var(--ring))"
    focusRingWidth: "2px"
  footer:
    backgroundColor: "hsl(var(--background))"
    textColor: "hsl(var(--muted-foreground))"
    typography: "{typography.caption}"
    padding: "24px"
    borderColor: "hsl(var(--border))"
    borderWidth: "1px"
---

## Overview

NAP-DMS (LCBP3) is an enterprise Document Management System for construction project document control. The interface is a **data-dense dashboard application** — not a marketing page. Users are document controllers, engineers, and project managers who work in extended sessions reviewing RFA, Transmittal, Correspondence, and Circulation documents. The design system is built on **shadcn/ui** with HSL CSS variables, **Inter** as the sole sans-serif, and a **dual-theme** system with **dark mode as the default**.

The chromatic discipline is **multi-status, not single-voltage**. Unlike consumer brands that hold one accent color, NAP-DMS requires a **5-color workflow status matrix** — green for approved, red for rejected, yellow for pending, blue for in-review, amber for draft — because the core UX problem is helping users scan document lifecycle states at a glance in dense list views. The primary brand blue carries CTAs and focus rings; the status matrix carries semantic meaning.

Typography is **Inter across every tier** — display, heading, body, label, caption. Weights range from 400 (body) to 700 (display), with 500-600 for emphasis. There is no monospace tier in UI chrome; code blocks in the AI chat panel use the system monospace stack as a fallback. The 36px display headline is the loudest moment, sitting at weight 700 with -0.02em tracking.

**Key Characteristics:**
- Dual-theme HSL tokens (`hsl(var(--token))`) — dark mode default, light mode optional, all colors as HSL CSS variables consumed by Tailwind.
- 5-color workflow status matrix (`{colors.status-approved}` / `{colors.status-rejected}` / `{colors.status-pending}` / `{colors.status-in-review}` / `{colors.status-draft}`) — the core semantic color system for document lifecycle states.
- 4-level priority matrix (urgent / high / medium / low) with red / orange / yellow / green — used in the IntegratedBanner component.
- Inter as sole sans-serif — no display family, no second typeface; weight range 400-700.
- shadcn/ui 8px radius default (`{rounded.lg}`) — 6px and 4px steps for tighter surfaces, no full-pill tier.
- Hairline elevation — 1px `hsl(var(--border))` outlines on cards in light mode, tonal contrast in dark mode; shadows reserved for popovers and dropdowns only.
- Data-dense layout — 12-column grid, 24px section gaps, 16px card padding, 48px table row height — optimized for document lists with 20-50 visible rows.
- ADR-021 IntegratedBanner — the workflow lifecycle component that carries document number, subject, status badge, priority indicator, and workflow action buttons in a single horizontal strip.

## Colors

### Brand

- **Primary (Light)** (`{colors.primary-light}` — HSL 220 78% 34%, ~#1e3a8a): The deep blue brand voltage in light mode. Wired as `--primary` in `:root`. Carries the default button background, focus ring (`--ring` at 220 78% 40%), active nav indicator, and `--chart-1`. Never used as a text color on light backgrounds — always as a fill or ring.
- **Primary (Dark)** (`{colors.primary-dark}` — HSL 207 92% 63%, ~#38bdf8): The bright blue brand voltage in dark mode. Wired as `--primary` in `.dark`. Shifts to a brighter, more saturated blue to maintain contrast against the dark navy background (HSL 221 67% 10%). Carries the same role as the light-mode primary.
- **Primary Foreground** (`{colors.primary-foreground-light}` / `{colors.primary-foreground-dark}`): The text color on primary fills — near-white in light mode (HSL 210 40% 98%), dark navy in dark mode (HSL 222 70% 12%). Ensures WCAG AA contrast on both themes.

### Secondary

- **Secondary (Light)** (`{colors.secondary-light}` — HSL 214 35% 94%): A soft gray-blue used for secondary button backgrounds and the DRAFT status badge fill. Wired as `--secondary`.
- **Secondary (Dark)** (`{colors.secondary-dark}` — HSL 221 42% 20%): A muted dark blue-gray for secondary surfaces in dark mode.

### Destructive

- **Destructive (Light)** (`{colors.destructive-light}` — HSL 0 84% 60%, ~#ef4444): The red used for the REJECTED status badge, destructive buttons, and form validation errors. Wired as `--destructive`.
- **Destructive (Dark)** (`{colors.destructive-dark}` — HSL 0 63% 31%): A deeper red for dark mode — darker to maintain contrast against the dark background while still reading as "danger."

### Muted

- **Muted (Light)** (`{colors.muted-light}` — HSL 214 35% 94%): The soft gray used for muted backgrounds — the file upload zone fill, table header background, and secondary card surfaces. Wired as `--muted`.
- **Muted (Dark)** (`{colors.muted-dark}` — HSL 221 38% 18%): A dark blue-gray for muted surfaces in dark mode.
- **Muted Foreground** (`{colors.muted-foreground-light}` / `{colors.muted-foreground-dark}`): The secondary text color — gray-blue in light mode (HSL 219 20% 42%), lighter gray in dark mode (HSL 214 23% 72%). Used for captions, metadata, and inactive nav links.

### Accent

- **Accent (Light)** (`{colors.accent-light}` — HSL 213 95% 93%): A very light blue used for hover states on list items and accent backgrounds. Wired as `--accent`.
- **Accent (Dark)** (`{colors.accent-dark}` — HSL 217 53% 26%): A medium blue for accent surfaces in dark mode.

### Surface

- **Background (Light)** (`{colors.background-light}` — HSL 210 40% 99%, ~#f8fafc): The page floor in light mode — near-white with a slight cool tint. Wired as `--background`.
- **Background (Dark)** (`{colors.background-dark}` — HSL 221 67% 10%, ~#0f172a): The page floor in dark mode — a deep navy slate. This is the dominant surface in the default theme.
- **Card (Light)** (`{colors.card-light}` — HSL 0 0% 100%, #ffffff): Pure white for card surfaces in light mode — one step lighter than the background.
- **Card (Dark)** (`{colors.card-dark}` — HSL 221 62% 13%, ~#1e293b): A slightly lighter navy than the background — provides tonal separation for cards in dark mode.
- **Popover (Light/Dark)**: Matches card values in both themes — popovers and cards share the same surface tone.

### Border & Input

- **Border (Light)** (`{colors.border-light}` — HSL 214 31% 89%, ~#cbd5e1): The default 1px border color for cards, dividers, and table cells. Wired as `--border` and applied globally via `@apply border-border`.
- **Border (Dark)** (`{colors.border-dark}` — HSL 219 36% 24%): A dark blue-gray border for dark mode — visible against the card surface but not stark.
- **Ring** (`{colors.ring-light}` / `{colors.ring-dark}`): The focus ring color — matches the primary hue in both themes (220 78% 40% light, 207 92% 63% dark).

### Chart

Five chart colors for data visualizations (document statistics, workflow analytics):
- **Chart-1**: Primary blue (220 70% 48% light / 207 92% 63% dark)
- **Chart-2**: Cyan (200 80% 45% light / 188 85% 52% dark)
- **Chart-3**: Purple (250 74% 60% light / 250 90% 70% dark)
- **Chart-4**: Teal (174 60% 40% light / 162 64% 50% dark)
- **Chart-5**: Amber (30 85% 55% light / 31 95% 62% dark)

### Workflow Status Matrix

The status matrix uses **Tailwind utility colors** (not CSS variables) because these are semantic indicators, not theme tokens:

- **Approved** (`{colors.status-approved}` — #22c55e, green-500): APPROVED, COMPLETED, ISSUED document states.
- **Rejected** (`{colors.status-rejected}` — #ef4444, red-500): REJECTED, CANCELLED document states.
- **Pending** (`{colors.status-pending}` — #eab308, yellow-500): PENDING document state.
- **In Review** (`{colors.status-in-review}` — #3b82f6, blue-500): IN_REVIEW document state.
- **Draft** (`{colors.status-draft}` — #f59e0b, amber-500): DRAFT and default/unknown states. Note: the DRAFT badge uses `hsl(var(--secondary))` in the StatusBadge component, but amber is the semantic color for draft in the workflow state color mapping.

### Priority Matrix

- **Urgent** (`{colors.priority-urgent}` — #dc2626, red-600): With `animate-pulse` in the IntegratedBanner.
- **High** (`{colors.priority-high}` — #f97316, orange-500)
- **Medium** (`{colors.priority-medium}` — #eab308, yellow-500)
- **Low** (`{colors.priority-low}` — #16a34a, green-600)

## Typography

### Font Family

The system runs **Inter** — loaded via `next/font` and wired as `--font-sans` — for every spoken surface. The fallback stack walks `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`. There is no serif tier, no display-specific family, and no monospace in UI chrome. The system monospace stack appears only in AI chat code blocks as a fallback.

### Hierarchy

| Token | Size | Weight | Line Height | Tracking | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 36px | 700 | 40px | -0.02em | Page titles, dashboard headers |
| `{typography.display-md}` | 30px | 700 | 36px | -0.02em | Section headers, modal titles |
| `{typography.heading-md}` | 24px | 600 | 32px | -0.01em | Card titles, panel headers |
| `{typography.heading-sm}` | 20px | 600 | 28px | 0 | Sub-section headers, card header titles |
| `{typography.body-lg}` | 18px | 400 | 28px | 0 | Lead paragraphs, document descriptions |
| `{typography.body-md}` | 16px | 400 | 24px | 0 | Default running text, form labels |
| `{typography.body-sm}` | 14px | 400 | 21px | 0 | Table cells, nav links, secondary text |
| `{typography.label-md}` | 14px | 500 | 20px | 0 | Button labels, badge text, tab labels |
| `{typography.caption}` | 12px | 400 | 16px | 0 | Metadata, timestamps, status badge text |

### Principles

Display weight reaches 700 only at the 36px and 30px tiers — the loudest moments. Heading tiers (24px, 20px) use 600. Body and labels share 400-500. The system uses negative letter-spacing (-0.02em / -0.01em) only on display and heading tiers to tighten large text; everything else sits at 0. The 14px body-sm tier is the workhorse for data-dense surfaces — table cells, nav links, and secondary text all run at this size.

## Layout

### Spacing System

- **Base unit:** 4px, with 8px and 16px as the dominant gap rhythms.
- **Tokens:** `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.base}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.2xl}` 48px · `{spacing.3xl}` 64px · `{spacing.section}` 96px.
- **Section padding (vertical):** 24px between cards, 32px between sections, 96px for page-level vertical rhythm.
- **Card internal padding:** 24px on content cards, 16px on compact cards and workflow banner.
- **Table row height:** 48px default, 40px header.

### Grid & Container

- **Max content width:** 1400px (2xl breakpoint), centered with 2rem padding.
- **Dashboard layout:** 12-column grid with sidebar (256px collapsed / 280px expanded) + main content area.
- **Document detail:** 2-column 2:1 grid (main content + sidebar metadata) on lg screens, single column on mobile.
- **Document list:** Full-width data table with column configuration.
- **AI chat panel:** Fixed 400px width side panel, slide-in from right.

### Rhythm

The interface holds a **single tempo** — consistent surface, consistent spacing, no band inversion. The visual rhythm comes from card-to-card separation (24px gaps), section-to-section separation (32px), and the status badge color matrix providing chromatic variation within a uniform layout. The IntegratedBanner at the top of every document detail page is the only "hero" element — a horizontal strip carrying document number, subject, status, priority, and workflow actions.

## Elevation

The system uses **hairline borders as the primary elevation device**. Shadows are reserved for floating surfaces only.

- **Flat (hairline border only):** cards, table rows, input fields, workflow banner — 99% of surfaces. 1px `hsl(var(--border))` outline.
- **Shadow (floating surfaces):** popovers, dropdown menus, tooltips, command palette — use shadcn/ui's default shadow utilities (`shadow-md`, `shadow-lg`).
- **Tonal lift (dark mode):** cards in dark mode lift off the background by ~3 points of lightness (HSL 221 62% 13% card vs 221 67% 10% background) — no shadow needed.
- **Focus ring:** 2px `hsl(var(--ring))` outline on interactive elements — the primary blue at reduced opacity.

## Shapes

The radius scale is **professional-soft** with no pill tier:

- `{rounded.none}` 0px — code block annotations, table cell corners.
- `{rounded.sm}` 4px — status badges, small inline elements.
- `{rounded.md}` 6px — input fields, small buttons.
- `{rounded.lg}` 8px — default card rounding, buttons, workflow banner, data table container.
- `{rounded.xl}` 12px — larger feature surfaces, modal dialogs.

There is no full-pill (9999px) tier. Even primary buttons use `{rounded.lg}` (8px). The 8px default matches shadcn/ui's "default" style and keeps the interface feeling professional rather than consumer-playful.

## Components

**`button-primary`** — The default CTA. `hsl(var(--primary))` fill, `hsl(var(--primary-foreground))` text, `{rounded.lg}` 8px radius, 8x16px padding, 36px height, weight 500. Used for "Submit," "Approve," "Save Changes" actions.

**`button-primary-hover`** — Primary fill at 90% opacity on hover. No separate hover color token — the opacity reduction provides the visual feedback.

**`button-secondary`** — `hsl(var(--secondary))` fill, `hsl(var(--secondary-foreground))` text, 8px radius, 36px height. Used for "Cancel," "Back" actions.

**`button-destructive`** — `hsl(var(--destructive))` fill, white text, 8px radius, 36px height. Used for "Reject," "Delete," "Cancel Document" actions.

**`button-outline`** — Transparent fill, `hsl(var(--foreground))` text, 1px `hsl(var(--border))` border, 8px radius, 36px height. Used for "Return," "Comment," tertiary actions.

**`top-nav`** — `hsl(var(--background))` surface, `hsl(var(--foreground))` text, 56px height, 1px bottom border. Houses the NAP-DMS wordmark, project selector, and user menu.

**`nav-link`** — Transparent background, `hsl(var(--muted-foreground))` text at 14px / 400, 8x12px padding. Active state switches to `hsl(var(--foreground))` at weight 500.

**`card`** — `hsl(var(--card))` surface, `hsl(var(--card-foreground))` text, 1px `hsl(var(--border))` border, 8px radius, 24px padding. The default content container for document details, metadata panels, and form sections.

**`card-header`** — Transparent background, `{typography.heading-sm}` (20px / 600), 16px bottom padding. The title row inside a card.

**`status-badge`** — 12px / 500 uppercase text, 4px radius, 2x8px padding, 20px height. Background color determined by the workflow status matrix. The core semantic indicator in document list views.

**`status-badge-approved`** — Green fill (#22c55e), white text. For APPROVED / COMPLETED / ISSUED.

**`status-badge-rejected`** — Red fill (#ef4444), white text. For REJECTED / CANCELLED.

**`status-badge-pending`** — Yellow fill (#eab308), white text. For PENDING.

**`status-badge-in-review`** — Blue fill (#3b82f6), white text. For IN_REVIEW.

**`status-badge-draft`** — Secondary fill (`hsl(var(--secondary))`), secondary-foreground text. For DRAFT.

**`workflow-banner`** — `hsl(var(--card))` surface, 1px border, 8px radius, 16x24px padding. The ADR-021 IntegratedBanner — carries document number, subject, StatusBadge, priority indicator, and workflow action buttons (Approve / Reject / Return / Acknowledge / Comment) in a single horizontal strip.

**`data-table`** — `hsl(var(--card))` surface, 1px border, 8px radius, 48px row height, 40px header height. Header row uses `hsl(var(--muted))` background at weight 500. The primary data browsing surface for document lists.

**`file-upload-zone`** — `hsl(var(--muted))` surface, 2px dashed `hsl(var(--border))` border, 8px radius, 32px padding. The Two-Phase Upload (ADR-016) drop zone — visual target for file drag-and-drop.

**`ai-chat-panel`** — `hsl(var(--card))` surface, 8px radius, 16px padding, 400px width. The ADR-026 side-panel for document chat — slides in from the right edge.

**`input-field`** — `hsl(var(--background))` surface, 1px `hsl(var(--input))` border, 6px radius, 8x12px padding, 36px height. Focus state shows 2px `hsl(var(--ring))` outline.

**`footer`** — `hsl(var(--background))` surface, `hsl(var(--muted-foreground))` text at 12px, 24px padding, 1px top border. Minimal — version info and copyright only.

## Do's and Don'ts

**Do** use the 5-color workflow status matrix consistently. Green = approved, red = rejected, yellow = pending, blue = in-review, amber/secondary = draft. These mappings are semantic — swapping them would break user recognition across the entire system.

**Do** use `hsl(var(--token))` for all theme-aware colors. Hardcoding hex values breaks dual-theme support — the same component must work in both light and dark mode by reading CSS variables.

**Do** keep Inter as the sole sans-serif. Adding a second font family fragments the typographic voice and increases bundle size. The weight range (400-700) provides enough hierarchy.

**Do** use hairline borders (1px `hsl(var(--border))`) for card elevation. Shadows are reserved for floating surfaces (popovers, dropdowns, tooltips) — using shadows on cards creates visual noise in data-dense views.

**Do** use the IntegratedBanner (ADR-021) at the top of every document detail page. It carries the workflow lifecycle context — document number, subject, status, priority, and available actions — in a single horizontal strip.

**Don't** introduce a full-pill (9999px) radius tier. The 8px default matches shadcn/ui's professional aesthetic; pill buttons would feel borrowed from a consumer product, not an enterprise DMS.

**Don't** use the primary blue for status indicators. The primary is the brand/CTA voltage; the status matrix is a separate semantic layer. Mixing them would confuse "brand action" with "document state."

**Don't** flatten the status badge colors to monochrome. The 5-color matrix exists for at-a-glance scanning in dense list views — removing color would force users to read text labels, increasing cognitive load by 3-5x.

**Don't** use `console.log` for debugging in frontend code. Use the browser DevTools console or remove before commit. (ADR compliance — Tier 1 CI blocker.)

**Don't** hardcode text strings — use i18n keys via `t('key.path')`. All user-facing text must be translatable. (See `05-08-i18n-guidelines.md`.)

## Known Gaps

- **Warning variant:** The StatusBadge component maps PENDING to `bg-yellow-500` via a custom class because shadcn/ui's default Badge variants don't include a "warning" tier. A proper `warning` variant should be added to the Badge component.
- **Success variant:** Similarly, APPROVED uses `bg-green-500` via custom class. A `success` variant should be formalized.
- **Focus states:** Only `--ring` is tokenized. Full focus-visible styles (outline offset, outline width) are handled per-component via Tailwind utilities, not centralized tokens.
- **Motion:** The `tailwindcss-animate` plugin is installed but only used for accordion animations. Transition tokens (duration, easing) are not formalized — components use Tailwind's default `transition-colors` / `duration-200`.
- **Mobile breakpoints:** The design system is optimized for desktop (1280px+). Mobile and tablet layouts exist but use simplified single-column stacks without dedicated tokens.
- **AI chat streaming:** The ADR-026 chat panel uses SSE streaming, but the typing animation and streaming text styles are not tokenized in this spec.
- **Print styles:** Document detail pages may need print-specific tokens for physical document control workflows — not represented here.
