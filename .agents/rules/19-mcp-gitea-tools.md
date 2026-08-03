# MCP Gitea Tools

MCP Gitea server ให้เครื่องมือสำหรับจัดการ Gitea repository — issues, comments, labels, milestones, topics, pull requests, releases, wiki, และ Gitea Actions ใช้สำหรับ:

- จัดการ issue tracking และ pull request workflow
- ตรวจสอบ CI/CD pipeline ผ่าน Gitea Actions (ADR-015 release management)
- จัดการ repository wiki สำหรับ documentation
- ตรวจสอบ release status และ deployment pipeline

## Available Tools (รวม 60+ tools)

### Issues & Comments

| Tool                  | หน้าที่                              |
| --------------------- | ------------------------------------ |
| `list_issues`         | แสดง issues ใน repo (paginated)      |
| `get_issue`           | ดู issue ตาม `index` (หมายเลข issue) |
| `create_issue`        | สร้าง issue ใหม่                     |
| `update_issue`        | แก้ไข issue (labels = REPLACE ทั้งหมด) |
| `delete_issue`        | ลบ issue (IRREVERSIBLE)              |
| `search_issues`       | ค้นหา issues ข้าม repo (type=issues/pulls) |
| `list_comments`       | แสดง comments ใน issue               |
| `create_comment`      | เพิ่ม comment                        |
| `update_comment`      | แก้ไข comment (ใช้ comment `id` ไม่ใช่ issue index) |
| `delete_comment`      | ลบ comment (ใช้ comment `id`)        |

### Labels & Milestones

| Tool                  | หน้าที่                              |
| --------------------- | ------------------------------------ |
| `list_labels`         | แสดง labels ทั้งหมด (ได้ทั้ง name + ID) |
| `create_label`        | สร้าง label ใหม่                     |
| `update_label`        | แก้ไข label                          |
| `delete_label`        | ลบ label (ใช้ label ID)              |
| `add_issue_labels`    | เพิ่ม labels ให้ issue (ใช้ label **names**) |
| `remove_issue_label`  | ลบ label จาก issue (ใช้ label **ID**) |
| `replace_issue_labels`| แทนที่ labels ทั้งหมด (ใช้ label **names**) |
| `clear_issue_labels`  | ล้าง labels ทั้งหมดของ issue          |
| `list_milestones`     | แสดง milestones                      |
| `get_milestone`       | ดู milestone ตาม ID                  |
| `create_milestone`    | สร้าง milestone                     |
| `update_milestone`    | แก้ไข milestone                     |
| `delete_milestone`    | ลบ milestone (IRREVERSIBLE)         |

### Topics & Pull Requests

| Tool                  | หน้าที่                              |
| --------------------- | ------------------------------------ |
| `list_topics`         | แสดง topics ของ repo                 |
| `replace_topics`      | แทนที่ topics ทั้งหมด (IRREVERSIBLE)  |
| `add_topic`           | เพิ่ม topic                          |
| `remove_topic`        | ลบ topic                             |
| `list_pull_requests`  | แสดง PRs (paginated)                 |
| `get_pull_request`    | ดู PR ตาม `index`                    |
| `create_pull_request` | สร้าง PR ใหม่                        |
| `update_pull_request` | แก้ไข PR (state, title, WIP toggle)  |
| `merge_pull_request`  | รวม PR (IRREVERSIBLE — ยืนยันก่อน!)  |
| `is_pull_merged`      | ตรวจสอบว่า PR ถูกรวมแล้วหรือไม่      |
| `list_pull_commits`   | แสดง commits ใน PR                   |
| `list_pull_files`     | แสดงไฟล์ที่เปลี่ยนใน PR              |

### Gitea Actions (CI/CD)

| Tool                          | หน้าที่                              |
| ----------------------------- | ------------------------------------ |
| `list_action_runs`            | แสดง action runs (CI/CD pipeline)   |
| `get_action_run`              | ดู action run ตาม ID                |
| `cancel_action_run`           | ยกเลิก action run ที่กำลังทำงาน     |
| `rerun_action_run`            | รัน action run ใหม่                 |
| `rerun_action_run_failed_jobs`| รันเฉพาะ jobs ที่ failed            |

### Releases & Wiki

| Tool                  | หน้าที่                              |
| --------------------- | ------------------------------------ |
| `list_releases`       | แสดง releases                       |
| `get_release`         | ดู release ตาม ID                    |
| `get_release_by_tag`  | ดู release ตาม tag                   |
| `create_release`      | สร้าง release ใหม่                   |
| `update_release`      | แก้ไข release                        |
| `delete_release`      | ลบ release                           |
| `list_wiki_pages`     | แสดง wiki pages                     |
| `get_wiki_page`       | อ่าน wiki page (plain Markdown)      |
| `create_wiki_page`    | สร้าง wiki page (plain Markdown)    |
| `update_wiki_page`    | แก้ไข wiki page (rename = ทำลาย links) |
| `delete_wiki_page`    | ลบ wiki page (recover ได้จาก git clone เท่านั้น) |
| `list_wiki_revisions` | แสดง revision history ของ wiki page |

### Repo & Utility

| Tool              | หน้าที่                              |
| ----------------- | ------------------------------------ |
| `resolve_repo`    | อ่าน owner/repo จาก `.git/config` (ใช้ก่อน batch งาน) |
| `list_my_repos`   | แสดง repos ที่ token มีสิทธิ์        |
| `update_repo`      | แก้ไข repo settings                  |
| `gitea_status`    | ตรวจสอบ connection status           |

## การใช้งานร่วมกับ Development Flow

**เมื่อจัดการ issues:**

1. ใช้ `resolve_repo` ครั้งเดียวก่อน batch งาน — เพื่อยืนยัน owner/repo
2. ใช้ `list_issues` พร้อม pagination (page 1-based, limit ≤ 100) — ดึงจนกว่าหน้าจะ return น้อยกว่า `limit`
3. ใช้ `search_issues({ type: 'issues' })` แทน `list_issues` หากต้องการกรอง PR ออก

**เมื่อจัดการ labels (critical gotcha):**

1. `list_labels` ก่อนเสมอ เพื่อ map name → ID
2. `add_issue_labels` / `replace_issue_labels` → ใช้ label **names** (`string[]`)
3. `remove_issue_label` → ใช้ label **ID** (`number`)
4. `create_issue` / `update_issue` `labels` field → ใช้ label **IDs** (`number[]`)

**เมื่อจัดการ PR:**

1. ตรวจ `is_pull_merged` ก่อน merge
2. ตรวจ `get_pull_request` ว่า `mergeable: true`
3. ได้รับอนุมัติจาก user ก่อนเลือก merge strategy (merge/squash/rebase/rebase-merge)
4. WIP/draft: แก้ title prefix `WIP:` / `[WIP]` / `Draft:` ผ่าน `update_pull_request({ title })`
5. ปิดไม่รวม: `update_pull_request({ state: 'closed' })` — commits ยังอยู่ใน head branch

**เมื่อตรวจสอบ CI/CD (ADR-015):**

1. ใช้ `list_action_runs` เพื่อดู pipeline runs ล่าสุด
2. ใช้ `get_action_run` เพื่อดูรายละเอียด run
3. หาก failed ใช้ `rerun_action_run_failed_jobs` เพื่อ rerun เฉพาะ jobs ที่ failed

**เมื่อจัดการ wiki:**

1. `pageName` = URL slug (เช่น `Home`, `Getting-Started`)
2. content = plain Markdown (API จัด base64 ภายในให้ — ห้ามส่ง base64 เอง)
3. `create_wiki_page` จะ fail ถ้า title มีอยู่แล้ว → ใช้ `update_wiki_page` แทน
4. `update_wiki_page` กับ `title` = rename = ทำลาย existing links

## ข้อควรระวัง

- **🔴 ห้าม merge PR โดยไม่ได้รับอนุมัติจาก user** — `merge_pull_request` เป็น IRREVERSIBLE
- **🔴 ห้าม `delete_issue` / `delete_label` / `delete_milestone` / `delete_comment` โดยไม่ยืนยัน** — IRREVERSIBLE (ไม่มี recycle bin)
- **🔴 ห้าม `replace_issue_labels` / `clear_issue_labels` โดยไม่อ่าน labels ปัจจุบัน** — จะเขียนทับทั้งหมด
- **🔴 ห้าม `replace_topics` โดยไม่ยืนยัน** — จะเขียนทับ topics ทั้งหมด (ส่ง `[]` เพื่อ clear)
- **⚠️ ระวัง `list_comments` ถูก truncate** — คืนเฉพาะหน้าแรก ไม่มี pagination ใน tool
- **⚠️ ระวัง `list_issues` อาจรวม PR** — ใช้ `search_issues({ type: 'issues' })` เพื่อกรอง
- **✅ ใช้ `resolve_repo` ก่อน batch งาน** — กัน owner/repo ผิด
- **✅ ใช้ comment `id` ไม่ใช่ issue `index`** สำหรับ `update_comment` / `delete_comment`
- **✅ ตรวจ `mergeable: true` ก่อน merge** ผ่าน `get_pull_request`

## Related Documents

- `specs/06-Decision-Records/ADR-015-release-management.md` — Release gates + Gitea Actions CI/CD
- `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` — Release management policy
