# MCP Gitea Tools

โปรเจกต์นี้มี Gitea MCP server **2 ตัว** รันควบคู่กัน (ดู config ใน `.devin/mcp_config.local.json` — ไฟล์นี้อยู่ใน `.git/info/exclude` ไม่ถูก commit):

| Server           | Implementation                      | วิธีรัน                                    | owner/repo                                                                     |
| ---------------- | ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `gitea`          | `@amonstack/gitea-mcp` (community)  | `npx` stdio                                | resolve จาก `.git/config` หรือ `GITEA_DEFAULT_OWNER/REPO` — ไม่ต้องส่งทุก call |
| `gitea-official` | `gitea/gitea-mcp` v1.8.0 (official) | Docker `docker.gitea.com/gitea-mcp-server` | **ต้องส่ง `owner` + `repo` ทุก call** — ไม่มี default                          |

ใช้สำหรับ:

- จัดการ issue tracking และ pull request workflow
- ตรวจสอบ CI/CD pipeline ผ่าน Gitea Actions (ADR-015 release management)
- จัดการ repository wiki สำหรับ documentation
- ตรวจสอบ release status และ deployment pipeline

## เลือกใช้ server ไหน

**ใช้ `gitea` (amonstack) เมื่อ:**

- งาน issues/comments/labels/milestones ทั่วไป — tools เฉพาะทาง ชื่อชัดเจน มี risk warning ใน description
- Issue dependencies/blocks (`add_issue_dependency`, `check_issue_blocked`) — official ไม่มี
- Repository topics — official ไม่มี
- Upload attachments จาก local file — official ไม่มี
- Merge PR แบบ tool เดี่ยว (`merge_pull_request` + `is_pull_merged`)
- ไม่แน่ใจ owner/repo — มี `resolve_repo` อ่านจาก `.git/config`

**ใช้ `gitea-official` เมื่อ:**

- อ่าน/เขียนไฟล์ใน repo (`get_file_contents`, `get_repository_tree`, `create_or_update_file`, `delete_file`) — amonstack ไม่มี
- จัดการ branches/tags (`create_branch`, `delete_branch`, `list_tags`, `create_tag` ฯลฯ) — amonstack ไม่มี
- ดู commits (`list_commits`, `get_commit`) — amonstack ไม่มี
- PR review (`pull_request_review_write`, `pull_request_read` method `get_reviews`/`get_diff`) — amonstack ไม่มี
- Gitea Actions: dispatch workflow, secrets/variables config, job logs, artifacts — amonstack มีแค่ run list/cancel/rerun
- Notifications, time tracking, packages, search users/orgs/teams — amonstack ไม่มี
- สร้าง/fork repository (`create_repo`, `fork_repo`)

---

## `gitea` — Available Tools (~75 tools, amonstack)

### Issues & Comments

| Tool             | หน้าที่                                             |
| ---------------- | --------------------------------------------------- |
| `list_issues`    | แสดง issues ใน repo (paginated)                     |
| `get_issue`      | ดู issue ตาม `index` (หมายเลข issue)                |
| `create_issue`   | สร้าง issue ใหม่                                    |
| `update_issue`   | แก้ไข issue (labels = REPLACE ทั้งหมด)              |
| `delete_issue`   | ลบ issue (IRREVERSIBLE)                             |
| `search_issues`  | ค้นหา issues ข้าม repo (type=issues/pulls)          |
| `list_comments`  | แสดง comments ใน issue                              |
| `create_comment` | เพิ่ม comment                                       |
| `update_comment` | แก้ไข comment (ใช้ comment `id` ไม่ใช่ issue index) |
| `delete_comment` | ลบ comment (ใช้ comment `id`)                       |

### Labels & Milestones

| Tool                   | หน้าที่                                      |
| ---------------------- | -------------------------------------------- |
| `list_labels`          | แสดง labels ทั้งหมด (ได้ทั้ง name + ID)      |
| `create_label`         | สร้าง label ใหม่                             |
| `update_label`         | แก้ไข label                                  |
| `delete_label`         | ลบ label (ใช้ label ID)                      |
| `add_issue_labels`     | เพิ่ม labels ให้ issue (ใช้ label **names**) |
| `remove_issue_label`   | ลบ label จาก issue (ใช้ label **ID**)        |
| `replace_issue_labels` | แทนที่ labels ทั้งหมด (ใช้ label **names**)  |
| `clear_issue_labels`   | ล้าง labels ทั้งหมดของ issue                 |
| `list_milestones`      | แสดง milestones                              |
| `get_milestone`        | ดู milestone ตาม ID                          |
| `create_milestone`     | สร้าง milestone                              |
| `update_milestone`     | แก้ไข milestone                              |
| `delete_milestone`     | ลบ milestone (IRREVERSIBLE)                  |

### Topics & Pull Requests

| Tool                  | หน้าที่                              |
| --------------------- | ------------------------------------ |
| `list_topics`         | แสดง topics ของ repo                 |
| `replace_topics`      | แทนที่ topics ทั้งหมด (IRREVERSIBLE) |
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

### Gitea Actions (CI/CD) — amonstack

| Tool                           | หน้าที่                           |
| ------------------------------ | --------------------------------- |
| `list_action_runs`             | แสดง action runs (CI/CD pipeline) |
| `get_action_run`               | ดู action run ตาม ID              |
| `cancel_action_run`            | ยกเลิก action run ที่กำลังทำงาน   |
| `rerun_action_run`             | รัน action run ใหม่               |
| `rerun_action_run_failed_jobs` | รันเฉพาะ jobs ที่ failed          |

### Releases & Wiki

| Tool                  | หน้าที่                                          |
| --------------------- | ------------------------------------------------ |
| `list_releases`       | แสดง releases                                    |
| `get_release`         | ดู release ตาม ID                                |
| `get_release_by_tag`  | ดู release ตาม tag                               |
| `create_release`      | สร้าง release ใหม่                               |
| `update_release`      | แก้ไข release                                    |
| `delete_release`      | ลบ release                                       |
| `list_wiki_pages`     | แสดง wiki pages                                  |
| `get_wiki_page`       | อ่าน wiki page (plain Markdown)                  |
| `create_wiki_page`    | สร้าง wiki page (plain Markdown)                 |
| `update_wiki_page`    | แก้ไข wiki page (rename = ทำลาย links)           |
| `delete_wiki_page`    | ลบ wiki page (recover ได้จาก git clone เท่านั้น) |
| `list_wiki_revisions` | แสดง revision history ของ wiki page              |

### Repo & Utility

| Tool            | หน้าที่                                               |
| --------------- | ----------------------------------------------------- |
| `resolve_repo`  | อ่าน owner/repo จาก `.git/config` (ใช้ก่อน batch งาน) |
| `list_my_repos` | แสดง repos ที่ token มีสิทธิ์                         |
| `update_repo`   | แก้ไข repo settings                                   |
| `gitea_status`  | ตรวจสอบ connection status                             |

---

## `gitea-official` — Available Tools (57 tools, consolidated)

tools ส่วนใหญ่เป็น **action-based** — tool เดียวรองรับหลาย operation ผ่านพารามิเตอร์ `method` (ระบุได้จาก dump จริงของ v1.8.0)

### Action-based tools (มี `method` parameter)

| Tool                        | Methods                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue_read`                | `get`, `get_comments`, `get_comment`, `get_labels`, `get_blocked_by`, `get_blocking`                                                                                                                                              |
| `issue_write`               | `create`, `update`, `add_comment`, `edit_comment`, `add_labels`, `remove_label`, `replace_labels`, `clear_labels`, `add_dependency`, `remove_dependency`                                                                          |
| `pull_request_read`         | `get`, `get_diff`, `get_files`, `get_status`, `get_reviews`, `get_review`, `get_review_comments`, `get_comments`                                                                                                                  |
| `pull_request_write`        | `create`, `update`, `close`, `reopen`, `merge`, `update_branch`, `add_reviewers`, `remove_reviewers`                                                                                                                              |
| `pull_request_review_write` | `create`, `submit`, `delete`, `dismiss`, `reply_comment`, `resolve_thread`, `unresolve_thread`                                                                                                                                    |
| `label_read`                | `list_repo_labels`, `get_repo_label`, `list_org_labels`                                                                                                                                                                           |
| `label_write`               | `create_repo_label`, `edit_repo_label`, `delete_repo_label`, `create_org_label`, `edit_org_label`, `delete_org_label`                                                                                                             |
| `milestone_read`            | `get`, `list`                                                                                                                                                                                                                     |
| `milestone_write`           | `create`, `update`, `edit`, `delete`                                                                                                                                                                                              |
| `wiki_read`                 | `list`, `get`, `get_revisions`                                                                                                                                                                                                    |
| `wiki_write`                | `create`, `update`, `delete`                                                                                                                                                                                                      |
| `actions_run_read`          | `list_workflows`, `get_workflow`, `list_runs`, `get_run`, `list_jobs`, `list_run_jobs`, `get_job`, `get_job_log_preview`, `download_job_log`, `list_artifacts`, `list_run_artifacts`, `get_artifact`, `download_artifact`         |
| `actions_run_write`         | `dispatch_workflow`, `cancel_run`, `rerun_run`                                                                                                                                                                                    |
| `actions_config_read`       | `list_repo_secrets`, `list_org_secrets`, `list_repo_variables`, `get_repo_variable`, `list_org_variables`, `get_org_variable`                                                                                                     |
| `actions_config_write`      | `upsert_repo_secret`, `delete_repo_secret`, `upsert_org_secret`, `delete_org_secret`, `create_repo_variable`, `update_repo_variable`, `delete_repo_variable`, `create_org_variable`, `update_org_variable`, `delete_org_variable` |
| `notification_read`         | `list`, `get`                                                                                                                                                                                                                     |
| `notification_write`        | `mark_read`, `mark_all_read`                                                                                                                                                                                                      |
| `timetracking_read`         | `list_issue_times`, `list_repo_times`, `get_my_stopwatches`, `get_my_times`                                                                                                                                                       |
| `timetracking_write`        | `start_stopwatch`, `stop_stopwatch`, `delete_stopwatch`, `add_time`, `delete_time`                                                                                                                                                |
| `package_read`              | `list`, `list_versions`, `get`                                                                                                                                                                                                    |
| `package_write`             | `delete`                                                                                                                                                                                                                          |
| `project_read`              | `list`, `get`, `list_columns`, `list_column_issues`                                                                                                                                                                               |
| `project_write`             | `create`, `update`, `delete`, `create_column`, `update_column`, `delete_column`, `add_issue`, `remove_issue`                                                                                                                      |
| `attachment_read`           | `list`, `get`, `download`                                                                                                                                                                                                         |

### Standalone tools (ไม่มี `method`)

| Tool                                                                                         | หน้าที่                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `get_me`                                                                                     | ดู user ปัจจุบันของ token                                       |
| `get_user_orgs`                                                                              | แสดง orgs ของ user ปัจจุบัน                                     |
| `search_users` / `search_org_teams` / `search_repos` / `search_issues`                       | ค้นหาข้าม instance                                              |
| `list_my_repos` / `list_org_repos`                                                           | แสดง repos                                                      |
| `create_repo` / `fork_repo`                                                                  | สร้าง/fork repository                                           |
| `get_repository_tree` / `get_file_contents` / `get_dir_contents`                             | อ่าน tree/ไฟล์ใน repo                                           |
| `create_or_update_file` / `delete_file`                                                      | เขียน/ลบไฟล์ (commit เดียว; `branch_name` + `message` required) |
| `list_branches` / `create_branch` / `delete_branch` / `rename_branch`                        | จัดการ branches                                                 |
| `list_tags` / `get_tag` / `create_tag` / `delete_tag`                                        | จัดการ tags                                                     |
| `list_commits` / `get_commit`                                                                | ดู commits                                                      |
| `list_releases` / `get_release` / `get_latest_release` / `create_release` / `delete_release` | จัดการ releases                                                 |
| `get_gitea_mcp_server_version`                                                               | ดู version ของ server                                           |

### ข้อจำกัดของ official

- **ต้องส่ง `owner` + `repo` ทุก call** — ไม่มี default จาก git config (ใช้ `np-dms`/`lcbp3` สำหรับ repo หลัก)
- ไม่มี issue dependencies tools (`get_blocked_by`/`get_blocking`/`add_dependency` เป็น read/partial เท่านั้น — เช็คความครบก่อนใช้; amonstack ครบกว่า)
- ไม่มี repository topics
- `attachment_read` มีแค่ read/download — upload ใช้ amonstack
- Pagination ใช้ `page`/`per_page` — page size สูงสุดตาม `MAX_RESPONSE_ITEMS` ของ Gitea server (default 50)
- ไม่มี milestone name resolution — ใช้ milestone ID ตรง ๆ

---

## การใช้งานร่วมกับ Development Flow

**เมื่อจัดการ issues (ใช้ `gitea`):**

1. ใช้ `resolve_repo` ครั้งเดียวก่อน batch งาน — เพื่อยืนยัน owner/repo
2. ใช้ `list_issues` พร้อม pagination (page 1-based, limit ≤ 100) — ดึงจนกว่าหน้าจะ return น้อยกว่า `limit`
3. ใช้ `search_issues({ type: 'issues' })` แทน `list_issues` หากต้องการกรอง PR ออก

**เมื่อจัดการ labels (ใช้ `gitea`, critical gotcha):**

1. `list_labels` ก่อนเสมอ เพื่อ map name → ID
2. `add_issue_labels` / `replace_issue_labels` → ใช้ label **names** (`string[]`)
3. `remove_issue_label` → ใช้ label **ID** (`number`)
4. `create_issue` / `update_issue` `labels` field → ใช้ label **IDs** (`number[]`)

**เมื่อจัดการ PR:**

- ผ่าน `gitea`: ตรวจ `is_pull_merged` → ตรวจ `get_pull_request` ว่า `mergeable: true` → ได้รับอนุมัติจาก user → `merge_pull_request`
- ผ่าน `gitea-official`: `pull_request_read` method `get`/`get_status` → ได้รับอนุมัติ → `pull_request_write` method `merge`
- WIP/draft: แก้ title prefix `WIP:` / `[WIP]` / `Draft:` (amonstack: `update_pull_request({ title })`; official: `pull_request_write` method `update`)
- ปิดไม่รวม: `update_pull_request({ state: 'closed' })` (amonstack) หรือ `pull_request_write` method `close` (official) — commits ยังอยู่ใน head branch

**เมื่อตรวจสอบ CI/CD (ADR-015):**

- ดู runs ล่าสุด: `list_action_runs` (amonstack) หรือ `actions_run_read` method `list_runs` (official)
- rerun เฉพาะ jobs ที่ failed: `rerun_action_run_failed_jobs` (amonstack เท่านั้น)
- dispatch workflow / ดู job log / artifacts: `actions_run_write` method `dispatch_workflow`, `actions_run_read` methods `get_job_log_preview`/`download_job_log`/`list_artifacts` (official เท่านั้น)
- secrets/variables: `actions_config_read`/`actions_config_write` (official เท่านั้น — **ห้าม log ค่า secret**)

**เมื่อจัดการ wiki:**

1. `pageName` = URL slug (เช่น `Home`, `Getting-Started`)
2. content = plain Markdown (API จัด base64 ภายในให้ — ห้ามส่ง base64 เอง)
3. `create_wiki_page` จะ fail ถ้า title มีอยู่แล้ว → ใช้ `update_wiki_page` แทน (amonstack) / `wiki_write` method `create` fail เช่นกัน → ใช้ `update` (official)
4. `update_wiki_page` กับ `title` = rename = ทำลาย existing links

## ข้อควรระวัง

- **🔴 ห้าม merge PR โดยไม่ได้รับอนุมัติจาก user** — `merge_pull_request` / `pull_request_write` method `merge` เป็น IRREVERSIBLE
- **🔴 ห้าม delete ทุกชนิดโดยไม่ยืนยัน** — `delete_issue` / `delete_label` / `delete_milestone` / `delete_comment` / `delete_file` / `delete_branch` / `delete_tag` ฯลฯ IRREVERSIBLE (ไม่มี recycle bin)
- **🔴 ห้าม `replace_issue_labels` / `clear_issue_labels` โดยไม่อ่าน labels ปัจจุบัน** — จะเขียนทับทั้งหมด
- **🔴 ห้าม `replace_topics` โดยไม่ยืนยัน** — จะเขียนทับ topics ทั้งหมด (ส่ง `[]` เพื่อ clear)
- **🔴 `create_or_update_file` / `delete_file` (official) เขียนตรงเข้า repo** — ยืนยัน branch + commit message กับ user ก่อน และห้าม push เข้า `main` โดยไม่ได้รับอนุมัติ (ตาม AGENTS.md hard limits)
- **⚠️ ระวัง `list_comments` (amonstack) ถูก truncate** — คืนเฉพาะหน้าแรก ไม่มี pagination ใน tool; official `issue_read` method `get_comments` รองรับ pagination
- **⚠️ ระวัง `list_issues` อาจรวม PR** — ใช้ `search_issues({ type: 'issues' })` เพื่อกรอง
- **⚠️ tool ชื่อซ้ำกันบางส่วน** (`list_issues`, `search_issues`, `list_my_repos`, `list_pull_requests`, `list_releases` ฯลฯ) — ระบุชัดเจนว่าใช้ server ไหนเมื่อผลอาจต่างกัน
- **✅ ใช้ `resolve_repo` (amonstack) ก่อน batch งาน** — กัน owner/repo ผิด
- **✅ ใช้ comment `id` ไม่ใช่ issue `index`** สำหรับ `update_comment` / `delete_comment`
- **✅ ตรวจ `mergeable: true` ก่อน merge** ผ่าน `get_pull_request` (amonstack) หรือ `pull_request_read` method `get` (official)

## Related Documents

- `.devin/mcp_config.local.json` — MCP server configuration (ไม่ถูก commit, อยู่ใน `.git/info/exclude`)
- `specs/06-Decision-Records/ADR-015-release-management.md` — Release gates + Gitea Actions CI/CD
- `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` — Release management policy
