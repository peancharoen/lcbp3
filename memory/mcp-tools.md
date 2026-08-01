# MCP Tools Documentation

## MCP MariaDB Tools

MCP MariaDB server provides tools for direct database inspection and management. Used for:

- Verifying schema against spec file `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- Debugging database issues without entering MySQL client
- Checking data in production/staging
- Validating schema changes before deploy

### Available Tools

| Tool                         | Purpose                      | Example Usage                                   |
| ---------------------------- | ---------------------------- | ----------------------------------------------- |
| `mcp1_mysql_test_connection` | Test database connection     | Verify MCP server connectivity                  |
| `mcp1_mysql_show_databases`  | List all databases           | See available databases                         |
| `mcp1_mysql_show_tables`     | List all tables in database  | See tables in `lcbp3`                           |
| `mcp1_mysql_describe_table`  | View table structure/columns | Check columns, types, keys of `correspondences` |
| `mcp1_mysql_query`           | Run SELECT query             | View data in table or join query                |
| `mcp1_mysql_insert`          | INSERT data                  | Add seed data or test data                      |
| `mcp1_mysql_update`          | UPDATE data                  | Modify data in table                            |
| `mcp1_mysql_delete`          | DELETE data                  | Delete data from table                          |

### Usage with Development Flow

**When writing new queries:**

1. Use `mcp1_mysql_describe_table` to check columns and types
2. Compare with `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
3. Use `mcp1_mysql_query` to test query before implement

**When changing schema (ADR-009):**

1. Use `mcp1_mysql_describe_table` to see current structure
2. Create SQL delta in `specs/03-Data-and-Storage/deltas/`
3. Use `mcp1_mysql_query` to verify result after apply delta

**When debugging database issues:**

1. Use `mcp1_mysql_query` to see actual data
2. Compare with spec and data dictionary
3. Check foreign keys and constraints

### Warnings

- **❌ NEVER use MCP MariaDB for DDL operations** (CREATE/ALTER/DROP) directly — must use SQL delta per ADR-009
- **✅ Use for DQL/DML operations** (SELECT/INSERT/UPDATE/DELETE) for debug and test only
- **⚠️ Be careful with DELETE operations** — may lose data in production
- **✅ Always verify schema against spec file** before writing queries
- **⚠️ MCP config ต้องแก้ผ่าน Windsurf UI เท่านั้น** — ห้ามแก้ไฟล์ `mcp_config.json` โดยตรง เพราะ Windsurf เขียนทับทุกครั้งที่ reload (D40)
- **⚠️ User `migration_bot` มีสิทธิ์ `ALL PRIVILEGES` บน `lcbp3` เท่านั้น** — ไม่สามารถ query `mysql.*` ได้

---

## MCP Memory Tools

MCP Memory server provides tools for managing Knowledge Graph and Long-term Memory. Used for:

- Storing project knowledge and context in Graph format (Entities + Relations + Observations)
- Searching and retrieving context from memory saved in previous sessions
- Creating/editing/deleting entities, relations, and observations in knowledge graph

### Available Tools

| Tool                       | Purpose                                        | Example Usage                                |
| -------------------------- | ---------------------------------------------- | -------------------------------------------- |
| `mcp3_create_entities`     | Create multiple new entities with observations | Create new entities like Project, User, Task |
| `mcp3_create_relations`    | Create relations between entities              | Create relation: Project → has → User        |
| `mcp3_add_observations`    | Add observations to existing entities          | Add additional context to entity             |
| `mcp3_delete_entities`     | Delete entities and related relations          | Delete unused entities                       |
| `mcp3_delete_relations`    | Delete relations between entities              | Delete incorrect or unused relations         |
| `mcp3_delete_observations` | Delete observations from entity                | Delete incorrect or stale context            |
| `mcp3_open_nodes`          | Retrieve entities by name                      | Get specific entity by name                  |
| `mcp3_read_graph`          | Read entire knowledge graph                    | See full graph structure                     |
| `mcp3_search_nodes`        | Search entities by query                       | Find entity by name, type, or observation    |

### Usage with Development Flow

**When saving new context:**

1. Use `mcp3_create_entities` to create new entities (if not exist)
2. Use `mcp3_create_relations` to link entities
3. Use `mcp3_add_observations` to add context/observations

**When searching context:**

1. Use `mcp3_search_nodes` to find relevant entities
2. Use `mcp3_open_nodes` to get specific entity data
3. Use `mcp3_read_graph` to see relations between entities

**When editing context:**

1. Use `mcp3_add_observations` to add new observations
2. Use `mcp3_delete_observations` to delete incorrect observations
3. Use `mcp3_create_relations` or `mcp3_delete_relations` to adjust relations

### Warnings

- **✅ Use for storing context that needs to be shared across multiple sessions** — e.g., important decisions, architecture decisions, rollout history
- **⚠️ Be careful when deleting entities** — may lose context still in use
- **✅ Check if entity exists before creating** — use `mcp3_search_nodes` or `mcp3_open_nodes` first
- **✅ Use clear and unique entity names** — to prevent confusion

---

## MCP Redis Tools

MCP Redis server (`@modelcontextprotocol/server-redis`) provides tools for direct Redis inspection. Used for:

- Inspecting BullMQ queue keys and metadata
- Debugging cache issues without entering `redis-cli`
- Verifying session store data
- Checking Redis connectivity from Devin CLI

### Available Tools

| Tool     | Purpose                      | Example Usage                                      |
| -------- | ---------------------------- | -------------------------------------------------- |
| `set`    | Set a Redis key-value pair   | Set test key with optional expiration              |
| `get`    | Get value by key from Redis  | Retrieve cached value or session data              |
| `delete` | Delete one or more keys      | Remove stale cache entries                         |
| `list`   | List keys matching a pattern | `list({ pattern: "bull:*" })` — list BullMQ queues |

### Usage with Development Flow

**When debugging BullMQ issues:**

1. Use `list({ pattern: "bull:*" })` to see all queue keys
2. Use `get({ key: "bull:ai-realtime:meta" })` to inspect queue metadata
3. Compare with expected queues per ADR-008/023A

**When debugging cache:**

1. Use `list({ pattern: "cache:*" })` to find cache keys
2. Use `get` to inspect cached values
3. Use `delete` to invalidate stale entries

### Warnings

- **⚠️ Be careful with `delete`** — may disrupt BullMQ queues or sessions in production
- **✅ Use `list` with specific patterns** — avoid `*` (too broad, may return thousands of keys)
- **✅ Redis URL includes password** — configured in `mcp_config.json`, not exposed in repo

---

## MCP Qdrant Tools

MCP Qdrant server (`@infoinlet/mcp-qdrant`) provides read-only tools for Qdrant vector database inspection. Used for:

- Verifying collection schema and stats
- Checking vector count and payload indexes
- Debugging AI search issues (ADR-023A/035)
- Validating `project_public_id` tenant isolation

### Available Tools

| Tool                      | Purpose                                  | Example Usage                                            |
| ------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `qdrant_list_collections` | List all collections                     | Verify `lcbp3_vectors` exists                            |
| `qdrant_collection_info`  | Collection config + stats                | Check vector size/distance, points count, payload schema |
| `qdrant_scroll`           | Browse points (with payload) — no vector | Inspect stored documents and their metadata              |
| `qdrant_count`            | Count points (optionally with filter)    | Count documents per project via filter                   |
| `qdrant_search`           | Vector similarity search                 | Test search with a query vector                          |
| `qdrant_health`           | Connectivity check (lists collections)   | Verify Qdrant is reachable                               |

### Usage with Development Flow

**When debugging AI search:**

1. Use `qdrant_collection_info({ collection: "lcbp3_vectors" })` to verify schema
2. Use `qdrant_count({ collection: "lcbp3_vectors" })` to check total vectors
3. Use `qdrant_scroll({ collection: "lcbp3_vectors", limit: 5 })` to inspect payloads
4. Use `qdrant_count({ collection: "lcbp3_vectors", filter: { must: [{ key: "project_public_id", match: { value: "UUID" } }] } })` to verify tenant isolation

### Warnings

- **✅ Read-only tools** — safe for inspection, no data modification
- **⚠️ `qdrant_search` requires a query vector** — provide array of numbers matching dimension (1024 for bge_dense)
- **✅ Verify `project_public_id` filter** — ADR-023A requires tenant isolation; use `qdrant_count` with filter to verify

---

## MCP Fetch Tools

MCP Fetch server (`mcp-fetch-server`) provides tools for fetching web content. Used for:

- Fetching documentation from public URLs
- Reading API responses from public endpoints
- Converting web pages to Markdown/plain text
- Extracting YouTube transcripts

### Available Tools

| Tool                       | Purpose                                  | Example Usage                        |
| -------------------------- | ---------------------------------------- | ------------------------------------ |
| `fetch_html`               | Fetch website as raw HTML                | Get unmodified HTML source           |
| `fetch_markdown`           | Fetch website converted to Markdown      | Read docs/articles in Markdown       |
| `fetch_txt`                | Fetch website as plain text (no HTML)    | Extract text content only            |
| `fetch_json`               | Fetch JSON from a URL                    | Read API responses                   |
| `fetch_readable`           | Fetch main content (Mozilla Readability) | Read articles without ads/navigation |
| `fetch_youtube_transcript` | Fetch YouTube video transcript           | Extract captions for video content   |

### Warnings

- **❌ Cannot access private/internal IP addresses** — SSRF protection blocks `192.168.*`, `10.*`, `127.*` (D76)
- **✅ Use for public URLs only** — documentation sites, public APIs, YouTube
- **⚠️ For internal services, use `curl` via exec or dedicated MCP** — e.g., Gitea MCP for Gitea API, Redis MCP for Redis
- **✅ `max_length` defaults to 5000 chars** — increase for longer content; use `start_index` for pagination

---

## MCP Gitea Tools

MCP Gitea server (`@amonstack/gitea-mcp`) provides tools for Gitea issue management. Used for:

- Creating and managing Gitea issues from Devin CLI
- Searching issues across repositories
- Managing issue labels, comments, milestones
- Linking commits to issues

### Available Tools

| Tool                 | Purpose                                    | Example Usage                                      |
| -------------------- | ------------------------------------------ | -------------------------------------------------- |
| `list_issues`        | List issues in a repository (paginated)    | `list_issues({ state: "all", limit: 50 })`         |
| `get_issue`          | Fetch one issue by index number            | `get_issue({ index: 42 })`                         |
| `create_issue`       | Create a new issue                         | `create_issue({ title: "Bug: ..." })`              |
| `update_issue`       | Update an issue (PATCH — partial update)   | `update_issue({ index: 42, state: "closed" })`     |
| `delete_issue`       | Permanently delete an issue (irreversible) | Use with caution — prefer `update_issue` close     |
| `search_issues`      | Search issues across ALL repos             | `search_issues({ query: "UUID", type: "issues" })` |
| `list_comments`      | List comments on an issue                  | Read issue discussion thread                       |
| `list_labels`        | List labels in a repository                | Map label names to IDs                             |
| `add_issue_labels`   | Add labels to an issue                     | Tag issues with categories                         |
| `remove_issue_label` | Remove a label from an issue               | Untag issues                                       |

### Usage with Development Flow

**When creating issues from features:**

1. Use `list_labels` to get label IDs
2. Use `create_issue({ title, body, labels: [ID] })` to create
3. Use `update_issue({ index, assignees: ["username"] })` to assign

**When searching for duplicates:**

1. Use `search_issues({ query: "keyword", type: "issues" })` to find across repos
2. Use `get_issue({ index })` to read full details

### Warnings

- **⚠️ `delete_issue` is IRREVERSIBLE** — prefer `update_issue({ state: "closed" })` to close instead
- **⚠️ `update_issue` with `labels` REPLACES entire label set** — use `add_issue_labels`/`remove_issue_label` for single changes
- **✅ `list_issues` may include pull requests** — use `search_issues({ type: "issues" })` to exclude PRs
- **✅ Default owner/repo from env vars** — `GITEA_DEFAULT_OWNER=np-dms`, `GITEA_DEFAULT_REPO=lcbp3`
- **⚠️ Gitea token stored in `mcp_config.json`** — user-level config, not committed to repo (D75)
