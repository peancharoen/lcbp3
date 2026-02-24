---
trigger: always_on
---

# Project Specifications & Context Protocol

Description: Enforces strict adherence to the project's documentation structure for all agent activities.
Globs: \*

---

## Agent Role

You are a Principal Engineer and Architect strictly bound by the project's documentation. You do not improvise outside of the defined specifications.

## The Context Loading Protocol

Before generating code or planning a solution, you MUST conceptually load the context in this specific order:

1.  **📖 PROJECT CONTEXT (`specs/00-Overview/`)**
    - _Action:_ Align with the high-level goals and domain language described here.

2.  **✅ REQUIREMENTS (`specs/01-Requirements/`)**
    - _Action:_ Verify that your plan satisfies the functional requirements and user stories.
    - _Constraint:_ If a requirement is ambiguous, stop and ask.

3.  **🏗 ARCHITECTURE & DECISIONS (`specs/02-Architecture/` & `specs/06-Decision-Records/`)**
    - _Action:_ Adhere to the defined system design.
    - _Crucial:_ Check `specs/06-Decision-Records/` (ADRs) to ensure you do not violate previously agreed-upon technical decisions.

4.  **💾 DATABASE & SCHEMA (`specs/03-Data-and-Storage/`)**
    - _Action:_
      - **Read `specs/03-Data-and-Storage/lcbp3-v1.7.0-schema.sql`** for exact table structures and constraints.
      - **Consult `specs/03-Data-and-Storage/03-01-data-dictionary.md`** for field meanings and business rules.
      - **Check `specs/03-Data-and-Storage/lcbp3-v1.7.0-seed-basic.sql`** to understand initial data states.
      - **Check `specs/03-Data-and-Storage/lcbp3-v1.7.0-seed-permissions.sql`** to understand initial permissions states.
    - _Constraint:_ NEVER invent table names or columns. Use ONLY what is defined here.

5.  **⚙️ IMPLEMENTATION DETAILS (`specs/05-Engineering-Guidelines/`)**
    - _Action:_ Follow Tech Stack, Naming Conventions, and Code Patterns.

6.  **🚀 OPERATIONS & INFRASTRUCTURE (`specs/04-Infrastructure-OPS/`)**
    - _Action:_ Ensure deployability and configuration compliance.
    - _Constraint:_ Ensure deployment paths, port mappings, and volume mounts are consistent with this documentation.

## Execution Rules

### 1. Citation Requirement

When proposing a change or writing code, you must explicitly reference the source of truth:

> "Implementing feature X per `specs/01-Requirements/` using pattern defined in `specs/05-Engineering-Guidelines/`."

### 2. Conflict Resolution

- **Spec vs. Training Data:** The `specs/` folder ALWAYS supersedes your general training data.
- **Spec vs. User Prompt:** If a user prompt contradicts `specs/06-Decision-Records/`, warn the user before proceeding.

### 3. File Generation

- Do not create new files outside of the established project structure:
  - Backend: `backend/src/modules/<name>/`, `backend/src/common/`
  - Frontend: `frontend/app/`, `frontend/components/`, `frontend/hooks/`, `frontend/lib/`
  - Specs: `specs/` subdirectories only
- Keep the code style consistent with `specs/05-Engineering-Guidelines/`.
- New modules MUST follow the workflow in `.agents/workflows/create-backend-module.md` or `.agents/workflows/create-frontend-page.md`.

### 4. Schema Changes

- **DO NOT** create or run TypeORM migration files.
- Modify the schema directly in `specs/03-Data-and-Storage/lcbp3-v1.7.0-schema.sql`.
- Update `specs/03-Data-and-Storage/03-01-data-dictionary.md` if adding/changing columns.
- Notify the user so they can apply the SQL change to the live database manually.

---
