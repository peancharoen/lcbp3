# Specs Folder Reorganization Plan

This plan reorganizes the specs/ directory into categorized folders (100-Infrastructures, 200-fullstacks, 300-others) with consistent numeric naming conventions, and updates AGENTS.md to document the new structure.

## Current State
- `specs/001-transmittals-circulation/` - Fullstack feature (plan.md, spec.md, tasks.md, test-report.md)
- `specs/002-infra-ops/` - Infrastructure work (plan.md, spec.md, quickstart.md, research.md, data-model.md, checklists/, contracts/)
- `specs/003-unified-workflow-engine/` - Fullstack core system (plan.md, spec.md, tasks.md, quickstart.md, research.md, data-model.md, checklists/, contracts/)
- Core specs folders (00-overview, 01-requirements, etc.) - Remain unchanged

## Target Structure
```
specs/
├── 00-overview/ (unchanged)
├── 01-requirements/ (unchanged)
├── 02-architecture/ (unchanged)
├── 03-Data-and-Storage/ (unchanged)
├── 04-Infrastructure-OPS/ (unchanged)
├── 05-Engineering-Guidelines/ (unchanged)
├── 06-Decision-Records/ (unchanged)
├── 08-Tasks/ (unchanged)
├── 88-logs/ (unchanged)
├── 99-archives/ (unchanged)
├── 100-Infrastructures/          # NEW: Infrastructure-related work
│   ├── 102-infra-ops/           # Moved from 002-infra-ops
│   └── README.md                # NEW: Category guide
├── 200-fullstacks/              # NEW: Backend + frontend features
│   ├── 201-transmittals-circulation/  # Moved from 001-transmittals-circulation
│   ├── 203-unified-workflow-engine/   # Moved from 003-unified-workflow-engine
│   └── README.md                # NEW: Category guide
└── 300-others/                  # NEW: Documentation, research, non-code tasks
    └── README.md                # NEW: Category guide
```

## Naming Convention
- Prefix: `nXX` where `n` = hundreds digit of category folder
- Example: `100-Infrastructures/102-infra-ops` (n=1, so 1xx)
- Example: `200-fullstacks/201-transmittals-circulation` (n=2, so 2xx)

## Steps

### 1. Create new category folders
- Create `specs/100-Infrastructures/`
- Create `specs/200-fullstacks/`
- Create `specs/300-others/`

### 2. Move existing folders with new names
- Move `specs/001-transmittals-circulation/` → `specs/200-fullstacks/201-transmittals-circulation/`
- Move `specs/002-infra-ops/` → `specs/100-Infrastructures/102-infra-ops/`
- Move `specs/003-unified-workflow-engine/` → `specs/200-fullstacks/203-unified-workflow-engine/`

### 3. Create README.md files for each category
- `specs/100-Infrastructures/README.md` - Explain infrastructure work scope
- `specs/200-fullstacks/README.md` - Explain fullstack feature scope
- `specs/300-others/README.md` - Explain documentation/research scope

### 4. Update AGENTS.md
- Add new section: "📁 Specs Folder Organization"
- Document the new category structure
- Explain naming convention (nXX prefix)
- Provide examples of what goes in each category
- Add rule: "When creating new feature specs, place in appropriate category folder"

### 5. Update specs/README.md
- Add reference to new category folders
- Update directory structure diagram
- Note that core specs (00-06, 08, 88, 99) remain unchanged

### 6. Create workflow (optional - pending user confirmation)
- Create `.windsurf/workflows/create-feature-spec.md`
- Workflow prompts user for feature type (infra/fullstack/other)
- Automatically places spec in correct category with proper naming

## Verification
- Verify all files moved correctly (no data loss)
- Verify internal file references still work (check for relative paths)
- Verify AGENTS.md documentation is clear
- Test that new structure is intuitive for team

## Files Modified
- `specs/100-Infrastructures/` (NEW)
- `specs/200-fullstacks/` (NEW)
- `specs/300-others/` (NEW)
- `specs/100-Infrastructures/README.md` (NEW)
- `specs/200-fullstacks/README.md` (NEW)
- `specs/300-others/README.md` (NEW)
- `AGENTS.md` (UPDATED - add Specs Folder Organization section)
- `specs/README.md` (UPDATED - add new categories to directory structure)

## Files Moved
- `specs/001-transmittals-circulation/` → `specs/200-fullstacks/201-transmittals-circulation/`
- `specs/002-infra-ops/` → `specs/100-Infrastructures/102-infra-ops/`
- `specs/003-unified-workflow-engine/` → `specs/200-fullstacks/203-unified-workflow-engine/`
