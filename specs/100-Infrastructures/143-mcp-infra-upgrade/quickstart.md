# Quick Start: MCP Infrastructure Upgrade — Node 24 Host + Qdrant v1.18

## Prerequisites

- Host server access (192.168.10.11) with sudo privileges
- Docker Compose operational (np-dms-lcbp3 stack running)
- Current Node.js v22.22.1 on host (verify: `node --version`)
- Current Qdrant v1.16.1 running (verify: `docker ps | grep qdrant`)
- Gitea API token created and stored in `~/.config/devin/mcp_config.json`

## Phase 1: Host Node.js v24 Upgrade

### 1. เพิ่ม NodeSource APT repository สำหรับ Node 24

```bash
# ดาวน์โหลดและรัน NodeSource setup script
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
```

### 2. ติดตั้ง Node.js v24

```bash
# ติดตั้ง (จะ replace Node 22 เดิม)
sudo apt install -y nodejs

# ตรวจสอบเวอร์ชัน
node --version  # ควรเป็น v24.x.x
npm --version   # ควรเป็น v11.x.x
```

### 3. ติดตั้ง pnpm ใหม่

```bash
# ติดตั้ง pnpm ใหม่ (compatible กับ Node 24)
npm i -g pnpm@10

# ตรวจสอบ
pnpm --version  # ควรเป็น 10.x.x
```

### 4. รีติดตั้ง dependencies

```bash
# Backend
cd /opt/np-dms-lcbp3/backend
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Frontend
cd /opt/np-dms-lcbp3/frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 5. อัปเดต engines field ใน package.json (ทำให้ T005/T006 ของ 103 สมบูรณ์)

```bash
# Backend
cd /opt/np-dms-lcbp3/backend
# เปลี่ยน "node": ">=22.0.0" เป็น "node": ">=24.0.0" ใน package.json

# Frontend
cd /opt/np-dms-lcbp3/frontend
# เปลี่ยน "node": ">=22.0.0" เป็น "node": ">=24.0.0" ใน package.json
```

### 6. ทดสอบ

```bash
# Backend tests
cd /opt/np-dms-lcbp3/backend
pnpm test

# Frontend build
cd /opt/np-dms-lcbp3/frontend
pnpm build
```

---

## Phase 2: Qdrant v1.18 Upgrade

### 1. หยุด Qdrant container

```bash
cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure
docker compose stop qdrant
```

### 2. อัปเดต image tag ใน docker-compose.yml

```yaml
# เปลี่ยนจาก
image: qdrant/qdrant:v1.16.1
# เป็น
image: qdrant/qdrant:v1.18.1
```

### 3. ลบ container และ volume เดิม (ไม่มี data ต้องเก็บ)

```bash
docker compose down qdrant
# ลบ volume ถ้ามี (ไม่มี production data)
docker volume rm 01-infrastructure_qdrant_data 2>/dev/null || true
```

### 4. รัน Qdrant v1.18.1

```bash
docker compose up -d qdrant

# ตรวจสอบ health
curl http://192.168.10.11:6333/healthz
# ควรได้: healthz check passed

# ตรวจสอบ collections (ควรว่างเปล่า)
curl http://192.168.10.11:6333/collections
```

### 5. Restart backend เพื่อ recreate collection

```bash
docker restart backend

# รอสักครู่แล้วตรวจสอบ collection
sleep 10
curl http://192.168.10.11:6333/collections
# ควรเห็น lcbp3_vectors
```

### 6. ทดสอบ AI module

```bash
cd /opt/np-dms-lcbp3/backend
pnpm test -- --testPathPattern="ai|qdrant"
```

---

## Phase 3: MCP Server Verification

### 1. ตรวจสอบ MCP config

```bash
cat ~/.config/devin/mcp_config.json
# ควรมี 8 servers: StitchMCP, devin/mariadb, devin/mcp-playwright, redis, qdrant, memory, fetch, gitea
```

### 2. ทดสอบแต่ละ MCP server แบบสั้นๆ

```bash
# Redis MCP
npx -y @modelcontextprotocol/server-redis "redis://default:617dbe51c49fee3e83dd8ff44393565cfe53e6b47c36b627@192.168.10.11:6379" </dev/null
# ควรเห็น: [Redis Connected] Successfully connected...

# Qdrant MCP
QDRANT_URL=http://192.168.10.11:6333 QDRANT_API_KEY="" npx -y @infoinlet/mcp-qdrant </dev/null
# ควรเริ่มได้โดยไม่มี compatibility error

# Memory MCP
npx -y @modelcontextprotocol/server-memory </dev/null
# ควรเห็น: Knowledge Graph MCP Server running on stdio

# Fetch MCP
npx -y mcp-fetch-server </dev/null
# ควรเริ่มได้โดยไม่มี error

# Gitea MCP (ต้องการ Node >=24)
GITEA_BASE_URL=http://192.168.10.11:3003 GITEA_TOKEN=7f6fa738f5b3cfe6731550ea173dd831a8ea390a npx -y @amonstack/gitea-mcp </dev/null
# ควรเริ่มได้โดยไม่มี EBADENGINE warning
```

### 3. Restart Devin CLI session

หลังจากอัปเกรดเสร็จ ให้ restart Devin CLI session เพื่อให้ MCP servers ใหม่ถูกโหลด

---

## Rollback

### Node.js Rollback

```bash
# ติดตั้ง Node 22 กลับ
sudo apt install nodejs=22.22.1+dfsg+~cs22.19.15-1ubuntu1
# หรือใช้ NodeSource setup_22.x
```

### Qdrant Rollback

```bash
# เปลี่ยน image tag กลับเป็น v1.16.1 ใน docker-compose.yml
# แล้ว
docker compose down qdrant
docker compose up -d qdrant
docker restart backend  # recreate collection
```
