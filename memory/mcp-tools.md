# MCP Tools Documentation

## MCP MariaDB Tools

MCP MariaDB server provides tools for direct database inspection and management. Used for:

- Verifying schema against spec file `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- Debugging database issues without entering MySQL client
- Checking data in production/staging
- Validating schema changes before deploy

### Available Tools

| Tool | Purpose | Example Usage |
|------|---------|----------------|
| `mcp1_mysql_test_connection` | Test database connection | Verify MCP server connectivity |
| `mcp1_mysql_show_databases` | List all databases | See available databases |
| `mcp1_mysql_show_tables` | List all tables in database | See tables in `lcbp3` |
| `mcp1_mysql_describe_table` | View table structure/columns | Check columns, types, keys of `correspondences` |
| `mcp1_mysql_query` | Run SELECT query | View data in table or join query |
| `mcp1_mysql_insert` | INSERT data | Add seed data or test data |
| `mcp1_mysql_update` | UPDATE data | Modify data in table |
| `mcp1_mysql_delete` | DELETE data | Delete data from table |

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

---

## MCP Memory Tools

MCP Memory server provides tools for managing Knowledge Graph and Long-term Memory. Used for:

- Storing project knowledge and context in Graph format (Entities + Relations + Observations)
- Searching and retrieving context from memory saved in previous sessions
- Creating/editing/deleting entities, relations, and observations in knowledge graph

### Available Tools

| Tool | Purpose | Example Usage |
|------|---------|----------------|
| `mcp3_create_entities` | Create multiple new entities with observations | Create new entities like Project, User, Task |
| `mcp3_create_relations` | Create relations between entities | Create relation: Project → has → User |
| `mcp3_add_observations` | Add observations to existing entities | Add additional context to entity |
| `mcp3_delete_entities` | Delete entities and related relations | Delete unused entities |
| `mcp3_delete_relations` | Delete relations between entities | Delete incorrect or unused relations |
| `mcp3_delete_observations` | Delete observations from entity | Delete incorrect or stale context |
| `mcp3_open_nodes` | Retrieve entities by name | Get specific entity by name |
| `mcp3_read_graph` | Read entire knowledge graph | See full graph structure |
| `mcp3_search_nodes` | Search entities by query | Find entity by name, type, or observation |

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
