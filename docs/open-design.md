`better-sqlite3` binary ติดตั้งสำเร็จแล้ว ตอนนี้รัน web

Open Design รันสำเร็จแล้ว!

## Setup เสร็จสมบูรณ์ ✅

| Component          | Status                      |
| ------------------ | --------------------------- |
| **Clone**          | `D:\nap-dms.open-design`    |
| **Node 24**        | v24.15.0 via fnm            |
| **pnpm**           | 10.33.2                     |
| **better-sqlite3** | prebuild binary ติดตั้งแล้ว |
| **Web UI**         | http://127.0.0.1:55502      |
| **Daemon**         | http://127.0.0.1:55490      |

**การใช้งานครั้งต่อไป** ใช้คำสั่งนี้เพื่อ start:

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use 24
cd D:\nap-dms.open-design
pnpm tools-dev run web
```

เปิด browser ที่ http://127.0.0.1:55502 แล้ว paste Anthropic API key ใน welcome dialog (หรือใช้ Claude Code ที่อยู่ใน PATH อยู่แล้ว) ได้เลยครับ
