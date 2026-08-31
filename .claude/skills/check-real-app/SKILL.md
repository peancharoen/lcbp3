---
name: check-real-app
description: Verify the deployed LCBP3 application through a real browser, including UI flows, API traffic, console errors, responsive rendering, and production-safe evidence collection after build or deployment.
version: 1.9.0
depends-on: []
handoffs: []
---

# check-real-app - Real App Verification

> See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for LCBP3-specific conventions.

Use this skill after build, test, or deployment when the user wants evidence that the real application works. Unit tests and a successful HTTP response are not substitutes for browser verification.

## Target and scope

- Use the URL supplied by the user. Otherwise default to `https://lcbp3.np-dms.work/`.
- Use localhost only when the user explicitly asks for local verification or the change has not been deployed.
- Establish the pages, roles, and flows in scope before interacting with the app. Do not expand a smoke test into broad production mutation.
- Read-only inspection is authorized by a request to verify the app. Creating, editing, uploading, approving, deleting, or otherwise mutating production data requires explicit authorization for that flow.
- Never bypass TLS verification, authentication, RBAC, or other security controls.

## Tool routing

Prefer the available MCP Playwright browser tools or their environment-equivalent names:

1. Navigate to the target with `browser_navigate`.
2. Inspect the accessibility tree with `browser_snapshot`; use returned element refs instead of guessed selectors.
3. Interact with `browser_click`, `browser_fill_form`, `browser_select_option`, and `browser_wait_for` as needed.
4. Collect `browser_console_messages`, `browser_network_requests`, and `browser_take_screenshot` evidence.
5. Use `browser_resize` to check at least one desktop and one mobile viewport when UI is in scope.
6. Close the browser with `browser_close` after verification.

Avoid `browser_run_code_unsafe`. Use `browser_evaluate` only for read-only inspection that cannot be obtained from snapshots, console, or network tools.

If MCP Playwright is unavailable, use `curl` only for bounded HTTP/API checks. A fetch tool or `curl` cannot prove client-side rendering, interaction, console health, or responsive behavior, so report the result as **HTTP-only verification**, not full real-app verification. Do not claim browser evidence that was not collected.

## Production-safe workflow

### 1. Baseline smoke check

- Navigate to the target URL and record the final URL, redirect chain when available, and HTTP status.
- Capture an accessibility snapshot and screenshot.
- Check browser console errors and failed network requests from the start of the session.
- Confirm the page does not expose `NaN`, `undefined`, raw stack traces, or integer internal IDs.

### 2. Authentication

- For public scope, verify the expected login page or unauthorized redirect without attempting to bypass it.
- For authenticated scope, use an existing authorized browser session or credentials supplied through an approved secure mechanism.
- Never print credentials, tokens, cookies, authorization headers, or session storage values. Redact them from evidence.
- If credentials or the required role are unavailable, continue with public checks and report authenticated flows as unverified.

### 3. Scoped UI flow

Verify the requested change with the smallest sufficient flow:

- Happy path and visible result.
- One relevant validation or error path when it can be tested without unsafe production mutation.
- Expected unauthorized behavior when the required role account is available.
- One nearby regression path affected by the change.
- Thai and English rendering when i18n is in scope.
- UUID values in URLs and responses remain strings; never treat an integer internal ID as public evidence.

For a production mutation, first state the exact records/actions that will be affected, obtain explicit authorization, use designated test data, and stop after the agreed action count. Cleanup is another mutation and also requires authorization unless it was included in the approved flow.

### 4. Console and network inspection

- Report unexpected console errors and warnings with the page and action that triggered them.
- Report failed requests, status codes, and sanitized request paths. Treat canceled requests separately from failures.
- Inspect relevant API response shapes without exposing sensitive or personal data.
- Browser tools do not prove backend log health. If backend logs are unavailable, state that limitation instead of inferring there were no backend errors.

### 5. Responsive check

For UI changes, verify representative desktop and mobile viewports. Capture evidence of the final state and check for clipped controls, horizontal overflow, unreadable text, and unusable dialogs or menus.

## No Fake Evidence Rule

Never report that the real app was verified unless it was opened and inspected. Distinguish these result levels:

- **Full browser verification:** real browser interaction plus screenshot, console, and network evidence.
- **Partial browser verification:** browser opened, but authentication, role, flow, or evidence capability was unavailable.
- **HTTP-only verification:** endpoint response checked without a real browser.
- **Not verified:** target or required capability was inaccessible.

## Mandatory output

Report all of the following:

### Scope and result

- Target environment and exact sanitized URLs checked.
- Verification level and overall pass/fail/blocked result.
- Account role used, without account identifiers or secrets.

### Checks performed

```text
PASS  GET /                         -> 200, login page rendered
PASS  unauthenticated /admin       -> redirected to login
FAIL  dashboard after navigation   -> API /api/example returned 500
SKIP  create Correspondence        -> production mutation not authorized
```

### Evidence

- Screenshots or tool-provided image artifacts.
- Relevant console findings, including an explicit statement when none were found.
- Relevant network statuses and sanitized response details.

### Limitations and risks

- Unverified flows and the precise reason each could not be checked.
- Missing roles, credentials, backend logs, or browser/MCP capabilities.
- Any production data mutation performed and its resulting record reference, sanitized when necessary.

### Next steps

- Only actions needed to resolve failures or complete skipped coverage.
