# Admin Panel UX Refactoring (2025-12-11)

**Objectives:**
- Standardize UX across Admin modules (Loading Skeletons, Alert Dialogs).
- Fix specific display bugs in Reference Data.
- Improve Admin Dashboard.

**Achievements:**
1.  **Dashboard Upgrade:**
    - Replaced `/admin` redirect with a proper Dashboard page showing stats and quick links.
    - Added `Skeleton` loading for stats.

2.  **Consistency Improvements:**
    - **Modules:** Organizations, Users, Projects, Contracts.
    - **Changes:**
        - Replaced "Loading..." text with `Skeleton` rows.
        - Replaced `window.confirm()` with `AlertDialog` (Shadcn UI).
        - Fixed `any` type violations in Users, Projects, Contracts.

3.  **Reference Data Overhaul:**
    - Refactored `GenericCrudTable` to include Skeleton loading and AlertDialogs natively.
    - Applied to all reference pages: Correspondence Types, Disciplines, Drawing Categories, RFA Types, Tags.
    - **Fixed Bug:** Missing "Drawing Categories" link in Reference Dashboard.
    - **Fixed Bug:** "Drawing Categories" page displaying incorrect columns (fixed DTO matching).

**Modified Files:**
- `frontend/app/(admin)/admin/page.tsx`
- `frontend/app/(admin)/admin/organizations/page.tsx`
- `frontend/app/(admin)/admin/users/page.tsx`
- `frontend/app/(admin)/admin/projects/page.tsx`
- `frontend/app/(admin)/admin/contracts/page.tsx`
- `frontend/app/(admin)/admin/reference/page.tsx`
- `frontend/app/(admin)/admin/reference/drawing-categories/page.tsx`
- `frontend/components/admin/organization-dialog.tsx` (Minor)
- `frontend/components/admin/reference/generic-crud-table.tsx`
- `frontend/components/ui/skeleton.tsx` (New)
