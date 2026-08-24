# Dependency Overrides (D144–D146)

> 🔴 **Tier 1 — CRITICAL (CI BLOCKER)** — ละเมิดแล้วทำให้ runtime พังเงียบ ๆ ตอน production
> กฎนี้ lock จาก incident 2026-08-23 (Qdrant Down → undici 8.10.0 จาก override ปลายเปิด)

## D144 — Bounded Override Rule

### กฎบังคับ

- **ห้าม** ใช้ override ปลายเปิด `">=x"` / `"*"` / `"latest"` ใน `pnpm-workspace.yaml` ทุกกรณี
- **ทุก override ต้องมีขอบบน** — ระบุเวอร์ชันตรง ๆ `"x.y.z"` หรือ range ที่มี upper bound `">=x <upper"`
- ปิด CVE / security advisory ให้ระบุเวอร์ชันตรง ๆ หรือใส่ `<upper` เสมอ ห้ามยกแค่ lower bound
- ก่อนเพิ่ม/แก้ override ต้องตรวจ consumer ทุกตัวที่ dependency นั้น flow ไปถึง (direct + transitive) ว่าทน major bump ได้

### เหตุผลเชิงกลไก

pnpm override ปลายเปิดจะถูก resolve ไป major ล่าสุดที่ตรงกับ selector โดยไม่สน `package.json` ของ consumer ที่ประกาศ range ไว้ ผลที่เกิดจริงใน incident 2026-08-23:

- `@qdrant/js-client-rest@1.17.0` ประกาศ `undici` 6.x range
- override `undici: ">="` ทำให้ pnpm เลือก `undici@8.10.0`
- lockfile เขียน importer specifier ทับ declaration เดิม → runtime โหลด undici 8 เข้า Qdrant client
- `undici.Agent` ของ 8 ตัด handler interface เดิมออก → `invalid onRequestStart method` → fetch failed → Qdrant ลง Down
- อาการหลอก: container healthy + `curl` ผ่าน (curl ไม่ผ่าน undici/fetch stack) → ทำให้ debug ผิดทางไป network

### ตัวอย่าง

```yaml
# ❌ WRONG — ปลายเปิด พังเงียบ ๆ ตอน runtime
overrides:
  undici: ">=6.0.0"
  nodemailer: "*"

# ✅ CORRECT — bounded หรือ pin ตรง ๆ
overrides:
  undici: "7.29.0"
  nodemailer: "^9.0.1"
```

### Audit checklist (ก่อนแก้ `pnpm-workspace.yaml`)

- [ ] ทุก override มีขอบบน (ไม่มี `>=` ลอย ๆ / `*` / `latest`)
- [ ] ตรวจ consumer ทุกตัว: `pnpm why <pkg>` ดูว่าใครใช้บ้าง
- [ ] ตรวจ major version ที่ consumer ประกาศ — override ห้ามข้าม major ที่ consumer ไม่ทน
- [ ] รัน `pnpm install` แล้วเช็ค `pnpm list <pkg> --depth=Infinity` ว่า resolve ตรงตามที่ตั้งใจ
- [ ] กรณีแก้ client library (undici, fetch stack, dispatcher) → reproduce ด้วย client จริง ไม่ใช่ `curl`

## D145 — undici Pin 7.29.0

- `undici` ต้อง resolve เป็น `7.29.0` เท่านั้น (ห้าม 8.x)
- เหตุผล: `@qdrant/js-client-rest` ส่ง `undici.Agent` เป็น `dispatcher` เข้า global fetch ของ Node 24 (undici 7 internal); undici 8 ตัด handler interface เดิม → `invalid onRequestStart method`
- jsdom 29 ก็ต้องการ undici 7.x internals (`wrap-handler.js`)
- ก่อน bump undici ต้อง regression test Qdrant client + jsdom ด้วย client จริง

## D146 — Service "Down" Debug Order

อาการ service Down บนหน้า monitoring ที่ **container healthy + `curl` จากใน container ผ่าน**:

1. สงสัย **client library / dependency layer** ก่อน network
2. Reproduce ด้วย client library ตัวจริง (`docker exec backend node -e "..."`) ไม่ใช่ `curl`
3. ตรวจ dependency version ที่ client ใช้จริง (`pnpm list --depth=Infinity` ใน image)
4. ถ้า client ใช้ dependency ผิด major → ตรวจ `pnpm-workspace.yaml` overrides ตาม D144

`curl` ไม่ผ่าน undici/fetch stack จึงไม่ reproduce ปัญหา dispatcher compatibility

## Related Documents

- `memory/project-memory-override.md` — D144/D145/D146 (canonical source)
- `specs/88-logs/session-2026-08-23-qdrant-down-undici-override.md` — incident log
- `pnpm-workspace.yaml` — overrides declaration
