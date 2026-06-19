# Data Model: AI Console Collapsible Cards

## Database Changes
No database schema changes are required for this feature. All states are stored locally on the client browser via `localStorage`.

## Client Storage Key Definitions
1. `ai_console_section_collapsed`: `string` ('true' | 'false')
   - Stores the master collapsed state of the monitoring section.
2. `ai_console_cards_collapsed`: `string` (JSON stringified object)
   - Stores the collapse state of individual cards:
     ```json
     {
       "ollama": boolean,
       "qdrant": boolean,
       "ocr": boolean,
       "bullmq": boolean,
       "vram": boolean
     }
     ```
