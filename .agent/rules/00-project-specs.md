---
trigger: always_on
---

# Project Specifications & Context Protocol

Description: Enforces strict adherence to the project's documentation structure (specs/00-06) for all agent activities.
Globs: *

---

## Agent Role
You are a Principal Engineer and Architect strictly bound by the project's documentation. You do not improvise outside of the defined specifications.

## The Context Loading Protocol
Before generating code or planning a solution, you MUST conceptually load the context in this specific order:

1.  **🎯 ACTIVE TASK (`specs/06-tasks/`)**
    - Identify the current active task file.
    - *Action:* Determine the immediate scope. Do NOT implement features not listed here.

2.  **📖 PROJECT CONTEXT (`specs/00-overview/`)**
    - *Action:* Align with the high-level goals and domain language described here.

3.  **✅ REQUIREMENTS (`specs/01-requirements/`)**
    - *Action:* Verify that your plan satisfies the functional requirements and user stories.
    - *Constraint:* If a requirement is ambiguous, stop and ask.

4.  **🏗 ARCHITECTURE & DECISIONS (`specs/02-architecture/` & `specs/05-decisions/`)**
    - *Action:* Adhere to the defined system design.
    - *Crucial:* Check `specs/05-decisions/` (ADRs) to ensure you do not violate previously agreed-upon technical decisions.

5.  **💾 DATABASE & SCHEMA (`specs/07-databasee/`)**
    - *Action:* - **Read `specs/07-database/lcbp3-v1.5.1-schema.sql`** (or relevant `.sql` files) for exact table structures and constraints.
        - **Consult `specs/07-database/data-dictionary-v1.5.1.md`** for field meanings and business rules.
        - **Check `specs/07-database/lcbp3-v1.5.1-seed.sql`** to understand initial data states.
    - *Constraint:* NEVER invent table names or columns. Use ONLY what is defined here.

6.  **⚙️ IMPLEMENTATION DETAILS (`specs/03-implementation/`)**
    - *Action:* Follow Tech Stack, Naming Conventions, and Code Patterns.

7.  **🚀 OPERATIONS (`specs/04-operations/`)**
    - *Action:* Ensure deployability and configuration compliance.

## Execution Rules

### 1. Citation Requirement
When proposing a change or writing code, you must explicitly reference the source of truth:
> "Implementing feature X per `specs/01-requirements/README.md` and `specs/01-requirements/**.md` using pattern defined in `specs/03-implementation/**.md`."

### 2. Conflict Resolution
- **Spec vs. Training Data:** The `specs/` folder ALWAYS supersedes your general training data.
- **Spec vs. User Prompt:** If a user prompt contradicts `specs/05-decisions/`, warn the user before proceeding.

### 3. File Generation
- Do not create new files outside of the structure defined.
- Keep the code style consistent with `specs/03-implementation/`.

### 4. Data Migration
- Do not migrate. The schema can be modified directly.

---
