# **คำสั่งตั้งค่า Gitea ใหม่ทั้งหมด + คำสั่งใช้งานประจำวัน / แก้ปัญหา / branch”**

---

📘 Git + Gitea (QNAP / Container Station) – Cheat Sheet
คู่มือนี้รวบรวม:

- คำสั่งตั้งค่า Gitea ใหม่ทั้งหมด
- คำสั่งใช้งาน Git ประจำวัน
- การแก้ไขปัญหา repository
- การทำงานกับ branch
- การ reset / clone / merge / rebase

---

## 🧩 SECTION 1 – การตั้งค่า Gitea ใหม่ทั้งหมด

🔹 1) เคลียร์ host key เดิม ใช้เมื่อ Gitea ถูก reset ใหม่ หรือ IP / key เปลี่ยน

```bash
ssh-keygen -R "[git.np-dms.work]:2222"
```

🔹 2) เชื่อมต่อครั้งแรก (จะมีคำถาม fingerprint)

```bash
ssh -T git@git.np-dms.work -p 2222
```

🔹 3) แสดง SSH public key เพื่อเพิ่มใน Gitea

```bash
cat /root/.ssh/id_ed25519.pub
cat /root/.ssh/id_rsa.pub
```

🔹 4) เพิ่ม remote ใหม่ (หากยังไม่ได้เพิ่ม)

```bash
git remote add origin ssh://git@git.np-dms.work:2222/np-dms/lcbp3.git
```

🔹 5) ลบ remote เดิมหากผิด

```bash
git remote remove origin
```

🔹 6) Push ครั้งแรกหลังตั้งค่า

```bash
git push -u origin main
```

🔹 7) Clone repo ใหม่ทั้งหมด

```bash
git clone ssh://git@git.np-dms.work:2222/np-dms/lcbp3.git
```

---

## 🧩 SECTION 2 – คำสั่ง Git ใช้งานประจำวัน

🟦 ตรวจสอบสถานะงาน

```bash
git status
```

🟦 ดูว่าแก้ไฟล์อะไรไป

```bash
git diff
```

🟦 เพิ่มไฟล์ทั้งหมด

```bash
git add .
```

🟦 Commit การแก้ไข

```bash
git commit -m "message"
```

🟦 Push

```bash
git push
```

🟦 Pull (ดึงงานล่าสุด)

```bash
git pull
```

---
## 🧩 SECTION 3 – ทำงานกับ Branch

### ดู branch ทั้งหมด

```bash
git branch
```

### สร้าง branch ใหม่

```bash
git checkout -b feature/login-page
```

### สลับ branch

```bash
git checkout main
```

### ส่ง branch ขึ้น Gitea

```bash
git push -u origin feature/login-page
```

### ลบ branch ในเครื่อง

```bash
git branch -d feature/login-page
```

### ลบ branch บน Gitea

```bash
git push origin --delete feature/login-page
```

### Merge branch → main

```bash
git checkout main
git pull
git merge feature/login-page
git push
```

### Rebase เพื่อให้ history สวย

```bash
git checkout feature/login-page
git rebase main
git checkout main
git merge feature/login-page
git push
```

---

## 🧩 SECTION 4 – แก้ไขปัญหา Repo

🔴 (1) Reset repo ทั้งหมดให้เหมือน remote

⚠ ใช้เมื่อไฟล์ในเครื่องพัง หรือแก้จนเละ

```bash
git fetch --all
git reset --hard origin/main
```

🔴 (2) แก้ปัญหา conflict ตอน pull

```bash
git pull --rebase
```

🔴 (3) ดู remote ว่าชี้ไปทางไหน

```bash
git remote -v
```

🔴 (4) เปลี่ยน remote ใหม่

```bash
git remote remove origin
git remote add origin ssh://git@git.np-dms.work:2222/np-dms/lcbp3.git
```

🔴 (5) Commit message ผิด แก้ใหม่

```bash
git commit --amend
```

🔴 (6) ย้อน commit ล่าสุด (ไม่ลบไฟล์)

```bash
git reset --soft HEAD~1
```

🔴 (7) ดู log แบบสรุป

```bash
git log --oneline --graph
```

🔴 (8) Clone repo ใหม่ทั้งหมด (เมื่อพังหนัก)

```bash
rm -rf lcbp3
git clone ssh://git@git.np-dms.work:2222/np-dms/lcbp3.git
```

---

## 📌 END

```
