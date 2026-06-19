# Quickstart: AI Console Collapsible Cards

## Setup and Verification

1. Start the frontend application:
   ```bash
   pnpm --filter lcbp3-frontend dev
   ```
2. Navigate to `http://localhost:3000/admin/ai` as a Superadmin.
3. Test collapsing and expanding the entire monitoring section using the chevron next to the header title.
4. Test collapsing individual cards (e.g. VRAM GPU Monitor).
5. Reload the page to verify that your collapsed states are restored from `localStorage`.
