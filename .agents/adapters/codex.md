# Codex Adapter (thin)

> 🔴 governance ทั้งหมดอยู่ที่ [`AGENTS.md`](../../AGENTS.md) + [`.devin/rules/`](../../.devin/rules/) — ห้ามคัดลอกมาไว้ที่นี่

## Load order

1. `AGENTS.md` — Codex อ่าน `AGENTS.md` ที่ repo root โดย convention → **LCBP3 Agent Execution Contract §1-9** มีผลทันที
2. `memory/project-memory-override.md` — **อ่านก่อน global Codex memory** เมื่องานพึ่ง repo context เดิม
   (ถ้าขัดกัน ให้ยึด project memory สำหรับข้อเท็จจริง LCBP3)
3. `.devin/rules/12-key-spec-files.md` → เลือก ADR/spec ตามประเภทงาน
4. `.devin/rules/` ไฟล์ที่เกี่ยวข้องกับงานนั้น

## Capability notes

- **Shell/filesystem:** มี (Codex CLI) — ต้อง run verification ตาม §7 จริง ห้ามข้าม
- **Sandbox/network:** อาจถูกจำกัด → หาก `pnpm install` / network call ล้มเหลว ให้รายงานตาม §5
  (`NOT EXECUTED — network restricted`) ห้ามสรุปว่า test ผ่าน
- **Git:** ห้าม `git push origin main` เอง (§2) — ต้องมี explicit authorization ต่อครั้ง

## Verification commands (LCBP3)

```bash
pnpm -C backend lint
pnpm -C backend typecheck
pnpm -C backend test
pnpm -C frontend lint
pnpm -C frontend build
```

ถ้าไม่ได้รัน → รายงานตามรูปแบบ §5 ตรงไปตรงมา

## Completion report

ตาม `AGENTS.md` §8 ทุกครั้ง
