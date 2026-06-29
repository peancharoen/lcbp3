# Research: AI Console Collapsible Cards

## Design & Mockup Research
We researched the Stitch project `6165107555700812297` screen "AI Console with Fixed Collapsible Cards" (screen name `30ce3255a7444cc99e4009fa303d948c`).

### Key Findings
1. The mockup implements a master section toggle and individual card toggles.
2. The HTML/CSS structure uses class-based animations (`collapsed` / `collapsed-content`) transitioning `max-height`, `opacity`, and `overflow`.
3. In Next.js/Tailwind, we can achieve this smoothly using standard state variables and Tailwind transition utilities (`transition-all duration-300 ease-in-out` combined with `max-h-0` / `max-h-[500px]` and `opacity-0` / `opacity-100`).

### Decisions
- **Decision**: Use React state + tailwind transitions + `localStorage` persistence.
- **Rationale**: Keeps implementation light, reactive, and aligned with standard Next.js client component patterns without introducing heavy external libraries.
- **Alternatives Considered**: 
  - Radix UI Collapsible component (not necessary as simple CSS transitions on max-height do the job with fewer imports).
