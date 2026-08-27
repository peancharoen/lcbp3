# Session — 2026-08-27 (PR Review + Merge + Stacked PR Fix)

## Summary

ตรวจสอบ PR ที่เปิดอยู่ใน Gitea (3 PR) วิเคราะห์ CI failure ของ #25/#26 (flaky test จาก vitest fork worker pool timeout) re-run CI ทั้งสองตัวตามลำดับ แล้ว squash merge ทั้ง 3 PR ลง main พบและแก้ปัญหา stacked PR #26 ที่ merge แล้วแต่ changes ไม่เข้า main เพราะ base branch ถูกลบก่อน

## ปัญหาที่พบ (Root Cause)

### 1. CI Failure บน PR #25 และ #26 (flaky test)

- **อาการ:** ทั้งสอง PR fail ที่ frontend vitest — test timeout 30s + `[vitest-pool-runner]: Timeout waiting for worker to respond`
- **Test ที่ fail ต่างกัน:** #25 fail ที่ `template-editor.test.tsx`, #26 fail ที่ `navbar.test.tsx` → ไม่ใช่ logic bug ของ test ใด
- **Root cause:** CI runner (QNAP container) ขาด RAM/CPU ขณะรัน parallel fork worker pool — เป็น infrastructure flakiness ไม่ใช่ code bug
- **หลักฐาน:** PR #27 รันทีหลังบน base เดียวกันผ่าน แสดงว่า code ไม่ได้เป็นตัวปัญหา

### 2. Stacked PR #26 ไม่เข้า main หลัง merge

- **อาการ:** หลัง squash merge #25 → #26 → #27 ตามลำดับ ตรวจพบว่า secret ยังอยู่ใน main (`.cifs-monitor.env.bak.20260817`, `.playwright-mcp/`, hardcoded push tokens ใน docs)
- **Root cause:** PR #26 เป็น stacked PR — base = `devin/cleanup-root-artifacts` (branch ของ #25) ไม่ใช่ `main` เมื่อ merge #25 ก่อน Gitea squash #26 เข้า base branch เดิม (ที่ถูก merge ไปแล้วและกำลังถูกลบ) ทำให้ changes ของ #26 ไม่เข้า main
- **เกตช์:** `merge_pull_request` API ของ Gitea merge เข้า base branch ของ PR ไม่ใช่ default branch — ถ้า base branch เป็น branch ชั่วคราวที่ถูกลบแล้ว changes จะหาย

## การแก้ไข (Fix)

| ไฟล์/การกระทำ              | การเปลี่ยนแปลง                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| CI re-run #606 (PR #25)    | `rerun_action_run({ runId: 606 })` — รอ 24 นาที ผ่าน                                                  |
| CI re-run #607 (PR #26)    | `rerun_action_run({ runId: 607 })` — รอ 19 นาที ผ่าน                                                  |
| Squash merge #25, #26, #27 | `merge_pull_request({ Do: "squash" })` ตามลำดับ                                                       |
| ลบ remote branches         | `git push origin --delete` 3 branches ที่ merge แล้ว                                                  |
| Pull main                  | `git pull origin main` — fast-forward `79045cf5..71764901`                                            |
| **แก้ stacked PR #26**     | `git fetch origin refs/pull/26/head:pr-26-temp` → `git cherry-pick 09d7f491` → `git push origin main` |
| ลบ temp branch             | `git branch -D pr-26-temp`                                                                            |

## กฎที่ Lock แล้ว

- **D176 — Stacked PR merge gotcha:** Gitea `merge_pull_request` merge เข้า base branch ของ PR ไม่ใช่ default branch — ถ้า PR เป็น stacked PR (base = branch ชั่วคราวของ PR อื่น) ต้อง merge และตรวจว่า changes เข้า main จริง ถ้า base branch ถูกลบก่อน ต้อง cherry-pick commit ของ PR นั้นลง main ตรง ๆ
- **D177 — Vitest fork pool flakiness บน QNAP:** ถ้า CI fail ที่ vitest `Timeout waiting for worker to respond` + test ที่ fail ต่างกันในแต่ละ run → เป็น runner resource pressure ไม่ใช่ code bug ให้ re-run ก่อน ถ้า fail ซ้ำที่ test เดียวกันถึงค่อย investigate เป็น logic bug

## Verification

- [x] PR #25 CI re-run ผ่าน (run #606, 08:42→09:07, success)
- [x] PR #26 CI re-run ผ่าน (run #607, 09:10→09:29, success)
- [x] PR #27 CI ผ่านอยู่แล้ว (run #608)
- [x] ทั้ง 3 PR squash merged ลง main
- [x] ลบ remote branches 3 ตัว (`devin/cleanup-root-artifacts`, `devin/remove-committed-secrets`, `devin/regression-tests-recent-fixes`)
- [x] main อัปเดตล่าสุด (`7a182d87`)
- [x] Secret ไม่เหลือใน main (`git grep -E "api/push/[A-Za-z0-9]{16,}"` ไม่มี match, `.cifs-monitor.env.bak.20260817` ไม่มี)
- [x] Open PR list = `[]` (ไม่มี PR เปิดค้าง)

## หมายเหตุ

- **ต้อง rotate push token ทั้ง 5 ตัวใน Uptime Kuma** (ตาม PR #26 body) — token ยังอยู่ใน git history ถึงแม้ลบออกจาก working tree แล้ว
- **Gitea token scope:** MCP `rerun_action_run` ต้องการ `write:repository` scope (token เดิมมีแค่ `write:issue, read:repository`) — user อัปเดต token แล้ว
