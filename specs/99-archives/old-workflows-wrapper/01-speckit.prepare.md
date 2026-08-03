---
auto_execution_mode: 0
description: Execute the full preparation pipeline (Specify -> Clarify -> Plan -> Tasks -> Analyze) in sequence.
---

# Workflow: speckit.prepare

This workflow orchestrates the sequential execution of the Speckit preparation phase skills (02-06).

1. **Step 1: Specify (Skill 02)**
   - Goal: Create or update the `spec.md` based on user input.
   - Action: Read and execute `.agents/skills/speckit-specify/SKILL.md`.

2. **Step 2: Clarify (Skill 03)**
   - Goal: Refine the `spec.md` by identifying and resolving ambiguities.
   - Action: Read and execute `.agents/skills/speckit-clarify/SKILL.md`.

3. **Step 3: Plan (Skill 04)**
   - Goal: Generate `plan.md` from the finalized spec.
   - Action: Read and execute `.agents/skills/speckit-plan/SKILL.md`.

4. **Step 4: Tasks (Skill 05)**
   - Goal: Generate actionable `tasks.md` from the plan.
   - Action: Read and execute `.agents/skills/speckit-tasks/SKILL.md`.

5. **Step 5: Analyze (Skill 06)**
   - Goal: Validate consistency across all design artifacts (spec, plan, tasks).
   - Action: Read and execute `.agents/skills/speckit-analyze/SKILL.md`.

## OCR-Specific Considerations

For OCR & AI Extraction prompt management features (ADR-037), consider:

- **Infrastructure**: Verify OCR sidecar (Desk-5439) and `/embed` endpoint availability
- **Database**: Check for `ai_prompts` table with `version` column and required deltas
- **Sidecar Integration**: Plan for system prompt threading through OCR endpoints
- **3-Step Pipeline**: Design for sequential execution (OCR → AI Extract → RAG Prep)
- **Optimistic Locking**: Include version conflict handling in prompt activation flows

For specialized OCR workflows, use `/speckit.ocr-prompt-management` instead.
