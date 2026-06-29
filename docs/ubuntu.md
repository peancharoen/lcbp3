# 📚 รวบรวมคำสั่ง CLI ใน Ubuntu แบบครบถ้วน (จัดหมวดหมู่)

## 📁 1. การนำทางและจัดการไดเรกทอรี (Navigation)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `pwd` | แสดง path ของไดเรกทอรีปัจจุบัน | `pwd` → `/home/user/Documents` |
| `cd` | เปลี่ยนไดเรกทอรี | `cd /var/log`, `cd ~` (ไป Home), `cd ..` (ขึ้น 1 ระดับ) |
| `ls` | แสดงรายการไฟล์ | `ls -la` (รายละเอียด+ไฟล์ซ่อน), `ls -lh` (ขนาดอ่านง่าย) |
| `tree` | แสดงโครงสร้างไดเรกทอรีแบบต้นไม้ | `tree -L 2` (แสดง 2 ระดับ) |
| `pushd` / `popd` | บันทึก/ย้อนกลับไดเรกทอรี | `pushd /var`, `popd` |
| `dirs` | แสดง stack ของไดเรกทอรี | `dirs -v` |

---

## 📄 2. การจัดการไฟล์ (File Management)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `touch` | สร้างไฟล์ว่าง / อัปเดต timestamp | `touch file.txt` |
| `cp` | คัดลอกไฟล์ | `cp -r src/ dest/` (คัดลอกโฟลเดอร์) |
| `mv` | ย้าย/เปลี่ยนชื่อไฟล์ | `mv old.txt new.txt` |
| `rm` | ลบไฟล์ | `rm -rf folder/` (ลบโฟลเดอร์+เนื้อหา) ⚠️ |
| `mkdir` | สร้างไดเรกทอรี | `mkdir -p a/b/c` (สร้างหลายระดับ) |
| `rmdir` | ลบไดเรกทอรีว่าง | `rmdir empty_folder` |
| `ln` | สร้างลิงก์ | `ln -s /path/to/file linkname` (symbolic link) |
| `file` | ตรวจสอบประเภทไฟล์ | `file image.png` |
| `stat` | แสดงข้อมูลละเอียดของไฟล์ | `stat file.txt` |
| `rename` | เปลี่ยนชื่อไฟล์แบบ batch | `rename 's/old/new/' *.txt` |

---

## 🔍 3. การค้นหาและดูเนื้อหาไฟล์ (Search & View)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `find` | ค้นหาไฟล์ | `find / -name "*.log" -size +10M` |
| `locate` | ค้นหาไฟล์รวดเร็ว (ใช้ database) | `locate python` |
| `grep` | ค้นหาข้อความในไฟล์ | `grep -r "error" /var/log/` |
| `cat` | แสดงเนื้อหาไฟล์ | `cat file.txt` |
| `less` | ดูไฟล์แบบเลื่อนได้ | `less large_file.log` |
| `more` | ดูไฟล์ทีละหน้า | `more file.txt` |
| `head` | ดูบรรทัดแรกๆ | `head -n 20 file.txt` |
| `tail` | ดูบรรทัดท้ายๆ | `tail -f log.txt` (ดูแบบ real-time) |
| `wc` | นับบรรทัด/คำ/ตัวอักษร | `wc -l file.txt` |
| `sort` | เรียงลำดับ | `sort -n numbers.txt` |
| `uniq` | ลบรายการซ้ำ (ต้อง sort ก่อน) | `sort file \| uniq` |
| `diff` | เปรียบเทียบไฟล์ | `diff file1 file2` |
| `which` | หา path ของคำสั่ง | `which python3` |
| `whereis` | หา binary/source/manual | `whereis nginx` |

---

## 📦 4. การจัดการแพ็กเกจ (Package Management - APT)
| คำสั่ง | คำอธิบาย |
|--------|----------|
| `sudo apt update` | อัปเดทรายการแพ็กเกจ |
| `sudo apt upgrade` | อัปเดตแพ็กเกจทั้งหมด |
| `sudo apt full-upgrade` | อัปเดตแบบจัดการ dependencies |
| `sudo apt install <pkg>` | ติดตั้งแพ็กเกจ |
| `sudo apt remove <pkg>` | ถอนการติดตั้ง (เหลือ config) |
| `sudo apt purge <pkg>` | ถอนการติดตั้ง + ลบ config |
| `sudo apt autoremove` | ลบ dependencies ที่ไม่ใช้แล้ว |
| `sudo apt clean` | ลบไฟล์ cache |
| `apt search <keyword>` | ค้นหาแพ็กเกจ |
| `apt show <pkg>` | แสดงข้อมูลแพ็กเกจ |
| `apt list --installed` | แสดงแพ็กเกจที่ติดตั้งแล้ว |
| `dpkg -i <file.deb>` | ติดตั้งไฟล์ .deb โดยตรง |
| `snap install <pkg>` | ติดตั้งผ่าน Snap |
| `flatpak install <pkg>` | ติดตั้งผ่าน Flatpak |

---

## ⚙️ 5. กระบวนการและระบบ (Process & System)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `ps` | แสดงกระบวนการ | `ps aux` |
| `top` / `htop` | Monitor กระบวนการแบบ real-time | `htop` |
| `kill` | ส่งสัญญาณหยุดกระบวนการ | `kill -9 <PID>` (force kill) |
| `pkill` | kill ตามชื่อ | `pkill firefox` |
| `killall` | kill ทุกกระบวนการที่ชื่อตรง | `killall chrome` |
| `bg` / `fg` | รันกระบวนการใน background/foreground | `Ctrl+Z` แล้ว `bg` |
| `jobs` | แสดงงานใน background | `jobs -l` |
| `nohup` | รันคำสั่งที่ไม่หยุดเมื่อ logout | `nohup ./script.sh &` |
| `systemctl` | จัดการ systemd services | `systemctl status nginx` |
| `service` | จัดการ services (เก่า) | `service ssh start` |
| `journalctl` | ดู log ของ systemd | `journalctl -u nginx -f` |
| `shutdown` | ปิดเครื่อง | `shutdown -h now`, `shutdown -r +10` |
| `reboot` | รีสตาร์ท | `sudo reboot` |
| `poweroff` | ปิดเครื่อง | `sudo poweroff` |

---

## 👤 6. ผู้ใช้และสิทธิ์ (Users & Permissions)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `whoami` | แสดง username ปัจจุบัน | `whoami` |
| `id` | แสดง UID, GID | `id username` |
| `who` / `w` | แสดงผู้ที่ login อยู่ | `w` |
| `last` | ประวัติการ login | `last` |
| `useradd` | เพิ่มผู้ใช้ | `sudo useradd -m newuser` |
| `usermod` | แก้ไขผู้ใช้ | `sudo usermod -aG sudo username` |
| `userdel` | ลบผู้ใช้ | `sudo userdel -r username` |
| `passwd` | เปลี่ยนรหัสผ่าน | `passwd`, `sudo passwd username` |
| `su` | สลับผู้ใช้ | `su - username` |
| `sudo` | รันคำสั่งด้วยสิทธิ์ root | `sudo apt update` |
| `chmod` | เปลี่ยนสิทธิ์ไฟล์ | `chmod 755 script.sh`, `chmod +x run.sh` |
| `chown` | เปลี่ยนเจ้าของไฟล์ | `sudo chown user:group file` |
| `chgrp` | เปลี่ยนกลุ่มของไฟล์ | `sudo chgrp developers folder/` |
| `umask` | ตั้งค่า default permissions | `umask 022` |

---

## 🌐 7. เครือข่าย (Networking)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `ip` | จัดการ network interfaces | `ip addr`, `ip route` |
| `ifconfig` | แสดงข้อมูล network (เก่า) | `ifconfig` |
| `ping` | ทดสอบการเชื่อมต่อ | `ping google.com` |
| `traceroute` | แสดงเส้นทาง packet | `traceroute google.com` |
| `netstat` | แสดงการเชื่อมต่อ | `netstat -tuln` |
| `ss` | แสดง socket statistics (ใหม่) | `ss -tuln` |
| `curl` | โอนข้อมูลจาก/ไปยัง server | `curl https://example.com` |
| `wget` | ดาวน์โหลดไฟล์ | `wget https://example.com/file.zip` |
| `scp` | คัดลอกไฟล์ผ่าน SSH | `scp file user@host:/path` |
| `rsync` | ซิงค์ไฟล์อย่างมีประสิทธิภาพ | `rsync -avz src/ dest/` |
| `ssh` | เชื่อมต่อระยะไกล | `ssh user@192.168.1.100` |
| `dig` / `nslookup` | ค้นหา DNS | `dig example.com` |
| `host` | ค้นหา DNS อย่างง่าย | `host example.com` |
| `nmcli` | จัดการ NetworkManager | `nmcli device status` |

---

## 🗜️ 8. การบีบอัดไฟล์ (Compression)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `tar` | จัดการ archive | `tar -czvf archive.tar.gz folder/` (บีบอัด) |
| | | `tar -xzvf archive.tar.gz` (คลาย) |
| `zip` / `unzip` | จัดการ .zip | `zip -r archive.zip folder/` |
| `gzip` / `gunzip` | บีบอัด .gz | `gzip file`, `gunzip file.gz` |
| `bzip2` | บีบอัด .bz2 | `bzip2 file` |
| `xz` | บีบอัด .xz | `xz file` |
| `7z` | จัดการ .7z | `7z a archive.7z folder/` |

---

## 💾 9. ดิสก์และที่เก็บข้อมูล (Disk & Storage)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `df` | แสดงพื้นที่ดิสก์ | `df -h` |
| `du` | แสดงขนาดไฟล์/โฟลเดอร์ | `du -sh *` |
| `mount` / `umount` | เมานต์/อันเมานต์ | `sudo mount /dev/sdb1 /mnt` |
| `lsblk` | แสดง block devices | `lsblk` |
| `fdisk` | จัดการ partition | `sudo fdisk -l` |
| `mkfs` | สร้าง filesystem | `sudo mkfs.ext4 /dev/sdb1` |
| `fsck` | ตรวจสอบ/ซ่อม filesystem | `sudo fsck /dev/sda1` |
| `blkid` | แสดง UUID ของ partitions | `sudo blkid` |
| `hdparm` | ข้อมูล/ตั้งค่า HDD | `sudo hdparm -I /dev/sda` |
| `ncdu` | วิเคราะห์การใช้ดิสก์ (interactive) | `ncdu /` |

---

## 🖥️ 10. ข้อมูลระบบและฮาร์ดแวร์ (System Info)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `uname` | ข้อมูล kernel | `uname -a` |
| `hostnamectl` | ข้อมูล hostname | `hostnamectl` |
| `lsb_release` | ข้อมูล Ubuntu version | `lsb_release -a` |
| `lscpu` | ข้อมูล CPU | `lscpu` |
| `lsmem` | ข้อมูล RAM | `lsmem` |
| `free` | แสดงการใช้ RAM | `free -h` |
| `uptime` | แสดงเวลาที่เครื่องเปิด | `uptime` |
| `date` | แสดง/ตั้งวันที่เวลา | `date`, `sudo date -s "2026-06-25 10:00:00"` |
| `cal` | แสดงปฏิทิน | `cal 2026` |
| `lspci` | แสดงอุปกรณ์ PCI | `lspci` |
| `lsusb` | แสดงอุปกรณ์ USB | `lsusb` |
| `lsmod` | แสดง kernel modules | `lsmod` |
| `dmesg` | แสดง kernel messages | `dmesg \| tail` |
| `dmidecode` | ข้อมูลฮาร์ดแวร์จาก BIOS | `sudo dmidecode` |
| `fastfetch` / `neofetch` | แสดงข้อมูลระบบสวยงาม | `fastfetch` |

---

## 📝 11. การแก้ไขข้อความ (Text Processing)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `nano` / `vim` / `vi` | Text editor | `nano file.txt` |
| `sed` | แก้ไขข้อความแบบ stream | `sed 's/old/new/g' file.txt` |
| `awk` | ประมวลผลข้อความแบบ column | `awk '{print $1}' file.txt` |
| `cut` | ตัดคอลัมน์ | `cut -d: -f1 /etc/passwd` |
| `tr` | แปลง/ลบตัวอักษร | `tr 'a-z' 'A-Z' < file` |
| `tee` | อ่านจาก stdin และเขียนลงไฟล์ | `echo "test" \| tee file.txt` |
| `xargs` | สร้างและรันคำสั่งจาก stdin | `find . -name "*.tmp" \| xargs rm` |
| `column` | จัดรูปแบบเป็นคอลัมน์ | `column -t file.txt` |

---

## 🔧 12. คำสั่งที่มีประโยชน์อื่นๆ (Useful Utilities)
| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `alias` | สร้างคำสั่งลัด | `alias ll='ls -la'` |
| `history` | แสดงประวัติคำสั่ง | `history \| grep apt` |
| `clear` | ล้างหน้าจอ | `clear` (หรือ `Ctrl+L`) |
| `echo` | แสดงข้อความ | `echo "Hello World"` |
| `printf` | แสดงข้อความแบบ format | `printf "%s\n" "Hello"` |
| `yes` | แสดงข้อความซ้ำๆ | `yes \| some_command` |
| `sleep` | หน่วงเวลา | `sleep 5` |
| `watch` | รันคำสั่งซ้ำๆ | `watch -n 2 'df -h'` |
| `time` | วัดเวลารันคำสั่ง | `time make` |
| `bc` | เครื่องคิดเลข | `echo "5+3" \| bc` |
| `cal` | ปฏิทิน | `cal` |
| `man` | คู่มือคำสั่ง | `man ls` |
| `info` | คู่มือแบบ info | `info coreutils` |
| `apropos` | ค้นหาจาก man pages | `apropos directory` |
| `tldr` | คู่มือแบบสั้น (ต้องติดตั้ง) | `tldr tar` |

---

## ⌨️ 13. Keyboard Shortcuts ใน Terminal
| Shortcut | คำอธิบาย |
|----------|----------|
| `Ctrl + C` | ยกเลิกคำสั่งปัจจุบัน |
| `Ctrl + Z` | หยุดคำสั่ง (suspend) |
| `Ctrl + D` | ออกจาก terminal / ส่ง EOF |
| `Ctrl + L` | ล้างหน้าจอ |
| `Ctrl + A` | ไปต้นบรรทัด |
| `Ctrl + E` | ไปท้ายบรรทัด |
| `Ctrl + U` | ลบตั้งแต่ cursor ถึงต้นบรรทัด |
| `Ctrl + K` | ลบตั้งแต่ cursor ถึงท้ายบรรทัด |
| `Ctrl + W` | ลบคำก่อนหน้า |
| `Ctrl + R` | ค้นหาคำสั่งจาก history |
| `Tab` | Auto-complete |
| `!!` | รันคำสั่งล่าสุดซ้ำ |
| `!$` | อาร์กิวเมนต์สุดท้ายของคำสั่งก่อนหน้า |

---

## 🎯 14. Pipeline และ Redirection
```bash
# Pipe (ส่ง output เป็น input ของคำสั่งถัดไป)
cat file.txt | grep "error" | wc -l

# Redirection
command > file.txt      # เขียนทับไฟล์
command >> file.txt     # เขียนต่อท้ายไฟล์
command 2> error.log    # redirect stderr
command &> all.log      # redirect ทั้ง stdout และ stderr
command < input.txt     # อ่านจากไฟล์
```

---

## 💡 Tips สำคัญ
1. **ใช้ `man <command>`** เพื่ออ่านคู่มือเต็มของคำสั่งใดๆ
2. **ใช้ `--help`** เพื่อดูตัวเลือกอย่างรวดเร็ว: `ls --help`
3. **Tab completion** ช่วยพิมพ์คำสั่งและ path ได้เร็วขึ้นมาก
4. **`sudo !!`** รันคำสั่งก่อนหน้าด้วย sudo
5. **`Ctrl + R`** ค้นหาคำสั่งเก่าจาก history
6. **ระวัง `rm -rf`** โดยเฉพาะกับ `sudo` - ลบถาวรไม่กู้คืน

---

📌 **หมายเหตุ:** คำสั่งเหล่านี้ส่วนใหญ่เป็น standard Unix/Linux commands ที่ใช้ได้ในทุกระบบ ไม่ใช่แค่ Ubuntu และสามารถใช้ร่วมกันได้กับ Debian, Linux Mint, Pop!_OS และ distro อื่นๆ ที่ใช้ Debian-based

ต้องการรายละเอียดเพิ่มเติมเกี่ยวกับคำสั่งไหน หรือต้องการตัวอย่างการใช้งานเฉพาะทาง บอกได้เลยครับ! 🚀
