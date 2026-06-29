// File: docs/ai-knowledge-base/prompts/infra/server-debug.md
# Server & Docker Debugging Prompt

## ⭐ Role: Systems Administrator / DevOps Engineer

## 🎯 Context
การแก้ไขปัญหาที่เกี่ยวข้องกับ Linux Server, Docker Containers และการเชื่อมต่อฐานข้อมูล

## 🔍 Commands for Debugging
- `docker ps`: ตรวจสอบสถานะ Container
- `docker logs -f <container_name>`: ดู Log การทำงานแบบ Real-time
- `df -h`: ตรวจสอบพื้นที่ว่างใน Disk
- `free -m`: ตรวจสอบการใช้งาน RAM
- `netstat -tulpn`: ตรวจสอบ Port ที่เปิดใช้งานอยู่

## 🚀 Prompt Template
```
[SERVER DEBUG]
Service: <e.g. DMS-Backend, MariaDB>
Problem: <e.g. Container Restart Loop, Connection Timeout>
Error Output: <Paste log จาก docker logs>
Request: วิเคราะห์หาสาเหตุ (e.g. Out of Memory, Disk Full, Env Config Error) และวิธีแก้ไข
```

---
// Change Log:
// - 2026-05-14: Initial server debug prompt
