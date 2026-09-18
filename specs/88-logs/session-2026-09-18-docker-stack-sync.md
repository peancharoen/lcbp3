# Session — 2026-09-18 (Docker Stack Spec↔Runtime Sync Convention)

## Summary

Audit + fix Docker lifecycle scripts (`/opt/np-dms/docker{up,start,stop,down}.sh`) ให้ตรงกับ stack จริง (เพิ่ม `05-ci`), verify compose files spec↔runtime ทั้งหมด, sync runtime `WEBHOOK_URL`→`N8N_WEBHOOK_URL`, พบ split-brain infra containers (7 ตัวสร้างจาก spec dir), และ lock convention "spec = canonical source, /opt/np-dms = runtime, ต้อง sync เสมอ" ลง rule ใหม่ `24-docker-stack-sync.md` + เพิ่ม `05-ci` เข้า `copy-env.sh`

## ปัญหาที่พบ (Root Cause)

1. **Lifecycle scripts stale** — เขียนก่อน `05-ci` layer ถูกสร้าง (2026-09-12) จึงไม่ manage gitea-runner เลย (ทั้งที่รันอยู่จริง); `dockerup.sh` start app ก่อน AI แต่ `dockerstart.sh` ทำตรงข้าม (contradiction กับ comment ตัวเองที่ claim "เหมือน dockerup.sh"); down/stop ไม่ใช่ true reverse ของ up; `docker ps` ไม่ใช้ sudo ทั้งที่ทุก compose command ใช้
2. **Runtime compose drift** — `/opt/np-dms/02-platform` ยังใช้ `WEBHOOK_URL` (deprecated — n8n log deprecation warning) ขณะ spec เปลี่ยนเป็น `N8N_WEBHOOK_URL` ไปแล้วตั้งแต่ 2026-09-05
3. **Split-brain infra project** — `docker inspect` labels เผย `cache`, `search`, `qdrant`, `cadvisor`, `node-exporter`, `redis-exporter`, `elasticsearch-exporter` ถูกสร้างจาก spec dir `/opt/np-dms-lcbp3/specs/.../01-infrastructure` (มีคนรัน `docker compose up` จาก spec เมื่อ 2026-08-01) ขณะ `mariadb`/`pma`/exporters บางตัวมาจาก `/opt/np-dms` — compose ยังควบคุมได้เพราะ project name (`lcbp3-infra`) เหมือนกัน แต่ `up -d` ครั้งถัดไปจะ recreate กลุ่มนี้ให้ label ตรง `/opt/np-dms` (data ใน named volumes — ไม่หาย)
4. **copy-env.sh gap** — sync script ไม่ครอบ `05-ci` (เพิ่ม layer ใหม่แล้วไม่ได้อัปเดต script)
5. **Convention ไม่ได้เขียนไว้** — ความสัมพันธ์ spec(canonical)↔runtime มีแค่ใน README + D259 comment ไม่มี rule file → agent session ใหม่ไม่รู้

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `/opt/np-dms/dockerup.sh` | เพิ่ม `05-ci` (สุดท้าย), ย้าย `03-application` หลัง `ocr-sidecar` (dependency order), แก้ header comment + rebuild note, `sudo docker ps` |
| `/opt/np-dms/dockerstart.sh` | เพิ่ม `05-ci` (สุดท้าย) — order เดิมถูกแล้ว, `sudo docker ps` |
| `/opt/np-dms/dockerstop.sh` | เพิ่ม `05-ci` (ลำดับแรก = true reverse), `sudo docker ps -a` |
| `/opt/np-dms/dockerdown.sh` | เพิ่ม `05-ci` (ลำดับแรก), `sudo docker ps` |
| `/opt/np-dms/02-platform/docker-compose.yml` | `WEBHOOK_URL` → `N8N_WEBHOOK_URL` (sync ตาม spec; running container ใช้ค่าเก่าจนกว่า `up -d` ครั้งถัดไป) |
| `/opt/np-dms/copy-env.sh` | เพิ่ม `copy_dir "$SPEC_BASE/05-ci" "/opt/np-dms/05-ci"` (compose + config.yaml + .env.example) |
| `.devin/rules/24-docker-stack-sync.md` | สร้างใหม่ — CRITICAL RULES: spec=canonical ห้ามรัน compose จาก spec dir, /opt/np-dms=runtime, sync เสมอ; directory mapping table; edit workflow; verify diff command; known quirks |
| `.devin/rules/README.md` | เพิ่ม index entry `24-docker-stack-sync.md` |

## Audit ผลลัพธ์ (spec vs runtime)

| Area | Result |
| -------------- | ---------------------- |
| `00-basic`, `01-infrastructure`, `03-application`, `04-ai`, `05-ci` | Identical |
| `02-platform` | Diff เดียว `WEBHOOK_URL` → แก้แล้ว (identical หลัง fix) |
| `ocr-sidecar` ทั้ง folder | ทุก shared file byte-identical; runtime มีแต่ `.bak.*`/`* copy*`/`.pytest_cache`/local `.env` artifacts |

## กฎที่ Lock แล้ว

- **D343 — Docker stack spec↔runtime sync convention**: spec dir = canonical (ห้ามรัน `docker compose` จาก spec dir เด็ดขาด — container จะได้ label path ผิด), `/opt/np-dms` = runtime เท่านั้น; แก้ไขได้ทั้งสองฝั่งแต่ต้อง sync เสมอ — spec→runtime ผ่าน `copy-env.sh`, runtime hotfix ต้อง commit กลับ spec (สืบจาก D259)
- **ลำดับมาตรฐาน** — up/start: `00→01→02→04-ai→ocr-sidecar→03→05-ci`; stop/down: exact reverse (consumers ปิดก่อน)
- **Lifecycle + sync scripts ไม่อยู่ใน git** — `docker*.sh`, `copy-env.sh` เป็น runtime-only files ที่ `/opt/np-dms/` (แก้ที่นั่นโดยตรง)
- **`.env` source = ฝั่ง spec** (`$SPEC_BASE/.env` = `ENV_SRC`) → copy ลง `/opt/np-dms/.env`; ทั้งคู่ gitignored

## Verification

- [x] `bash -n` ผ่านทั้ง 4 scripts + copy-env.sh
- [x] `docker compose config --quiet` ผ่านบน `02-platform` หลังแก้
- [x] `diff` spec vs runtime ทุก layer — identical หลัง sync
- [x] `.env` 2 ฝั่ง byte-identical (md5 เท่ากัน), spec `.env` gitignored+untracked
- [x] `docker inspect` labels ยืนยัน split-brain (documented เป็น known quirk — converge หลัง `up -d`)
- [x] Commit `e57b2e91` (local — ยังไม่ push)
