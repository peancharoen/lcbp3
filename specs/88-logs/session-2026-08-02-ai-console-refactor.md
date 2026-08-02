# Session — 2026-08-02 (AI Console Frontend Refactor — Sub-menu)

## Summary

ย้าย AI Console tabs (System Toggle, RAG Playground, Prompt Editor, Sandbox Testing) ออกจากหน้าเดียวเป็น sub-menu แบบ collapsible ใน sidebar พร้อมแยก route แต่ละ tab และใช้ Next.js layout wrapper ทำให้ Infrastructure Monitoring คงอยู่ในทุกหน้า

## ปัญหาที่พบ (Root Cause)

AI Console เดิมเป็นหน้าเดียว (`/admin/ai/page.tsx`) ที่มีทั้งหมด 906 บรรทัด รวม Tabs UI, Infrastructure Monitoring, System Toggle, RAG Playground, Prompt Management และ Sandbox Testing ไว้ในไฟล์เดียว — ทำให้ยากต่อการดูแลและไม่สอดคล้องกับโครงสร้าง sidebar แบบ collapsible menu ที่ใช้ในส่วน Operations

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `frontend/components/admin/ai/ai-constants.ts` | สร้างใหม่ — shared constants (`MAIN_MODEL_NAME`, `OCR_MODEL_NAME`) + helpers (`toCanonicalModel`, `ensureArray`) |
| `frontend/components/admin/ai/AiConsoleHeader.tsx` | สร้างใหม่ — header + AI Enabled/Disabled badge (ใช้ `useAiStatus`) |
| `frontend/components/admin/ai/AiInfrastructureMonitoring.tsx` | สร้างใหม่ — แยก monitoring section (5 การ์ด: Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM) พร้อม state ย่อ/ขยาย + localStorage |
| `frontend/app/(admin)/admin/ai/layout.tsx` | สร้างใหม่ — Next.js layout wrapper ห่อทุก sub-page ด้วย Header + Infrastructure Monitoring |
| `frontend/app/(admin)/admin/ai/system/page.tsx` | สร้างใหม่ — System Toggle (เปิด/ปิด AI + Protection/Polling cards) |
| `frontend/app/(admin)/admin/ai/rag-playground/page.tsx` | สร้างใหม่ — RAG Playground (สืบค้นเอกสาร + คำตอบ + citations) |
| `frontend/app/(admin)/admin/ai/prompts/page.tsx` | สร้างใหม่ — Prompt Editor (ใช้ `PromptManagementTabs` เดิม) |
| `frontend/app/(admin)/admin/ai/sandbox/page.tsx` | สร้างใหม่ — Sandbox Testing (ใช้ `SandboxTabs` เดิม) |
| `frontend/app/(admin)/admin/ai/page.tsx` | เปลี่ยนจาก 906 บรรทัดเป็น redirect 13 บรรทัด → `/admin/ai/system` |
| `frontend/components/admin/sidebar.tsx` | เปลี่ยน AI Console จาก flat link เป็น collapsible menu พร้อม 4 children |
| `frontend/components/admin/__tests__/sidebar.test.tsx` | อัปเดต test ให้ตรงกับ collapsible menu pattern |

## กฎที่ Lock แล้ว

- **D70: AI Console Sub-menu Structure** — AI Console ใน sidebar เป็น collapsible menu มี 4 children: `ระบบ` (`/admin/ai/system`), `RAG Playground` (`/admin/ai/rag-playground`), `แก้ไข Prompt` (`/admin/ai/prompts`), `ทดสอบ Sandbox` (`/admin/ai/sandbox`)
- **D71: Infrastructure Monitoring Persistence** — ใช้ Next.js `layout.tsx` ที่ `/admin/ai/` เพื่อ render `AiConsoleHeader` + `AiInfrastructureMonitoring` ในทุก sub-page (ไม่ต้อง import ซ้ำในแต่ละหน้า)
- **D72: AI Console Default Route** — `/admin/ai` redirect ไป `/admin/ai/system` เป็น default sub-page
- **D73: Per-page State Management** — แต่ละ sub-page มี state ของตัวเอง ไม่ใช้ shared store; SandboxTabs และ PromptManagementTabs คง internal tab toggle เดิม

## Verification

- [x] `tsc --noEmit` — exit 0 (zero errors)
- [x] `eslint` — zero errors/warnings บนไฟล์ใหม่และไฟล์ที่แก้ทั้งหมด
- [ ] Sidebar test ยังไม่ได้รัน (อัปเดต test แล้ว แต่ยังไม่ได้ `pnpm test`)
- [ ] Browser preview ยังไม่ได้ทดสอบ
