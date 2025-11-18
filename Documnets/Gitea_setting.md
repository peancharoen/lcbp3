# การติดตั้ง Gitea ใน Docker

* user id ของ gites:

  * uid=1000(git) gid=1000(git) groups=1000(git)

## กำหนดสิทธิ

```bash
chown -R 1000:1000 /share/Container/gitea/
[/share/Container/git] # ls -l /share/Container/gitea/etc/app.ini
[/share/Container/git] # setfacl -R -m u:1000:rwx /share/Container/gitea/
[/share/Container/git] # setfacl -R -m u:70:rwx /share/Container/git/postgres/
getfacl /share/Container/git/etc/app.ini
chown -R 1000:1000 /share/Container/gitea/
ล้าง
setfacl -R -b /share/Container/gitea/

chgrp -R administrators /share/Container/gitea/
chown -R 1000:1000 /share/Container/gitea/etc /share/Container/gitea/lib /share/Container/gitea/backup
setfacl -m u:1000:rwx -m g:1000:rwx /share/Container/gitea/etc /share/Container/gitea/lib /share/Container/gitea/backup
```

## Docker file

```yml
# File: share/Container/git/docker-compose.yml
# DMS Container v1_4_1 : แยก service และ folder, Application name: git, Servive:gitea
networks:
  lcbp3:
    external: true
  giteanet:
    external: true
    name: gitnet

services:
  gitea:
    image: gitea/gitea:latest-rootless
    container_name: gitea
    restart: always
    stdin_open: true
    tty: true
    environment:
      # ---- File ownership in QNAP ----
      USER_UID: "1000"
      USER_GID: "1000"
      TZ: Asia/Bangkok
      # ---- Server / Reverse proxy (NPM) ----
      GITEA__server__ROOT_URL: https://git.np-dms.work/
      GITEA__server__DOMAIN: git.np-dms.work
      GITEA__server__SSH_DOMAIN: git.np-dms.work
      GITEA__server__START_SSH_SERVER: "true"
      GITEA__server__SSH_PORT: "22"
      GITEA__server__SSH_LISTEN_PORT: "22"
      GITEA__server__LFS_START_SERVER: "true"
      GITEA__server__HTTP_ADDR: "0.0.0.0"
      GITEA__server__HTTP_PORT: "3000"
      GITEA__server__TRUSTED_PROXIES: "127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
      # --- การตั้งค่าฐานข้อมูล
      GITEA__database__DB_TYPE: mysql
      GITEA__database__HOST: mariadb:3306
      GITEA__database__NAME: "gitea"
      GITEA__database__USER: "gitea"
      GITEA__database__PASSWD: "Center#2025"
      # --- repos
      GITEA__repository__ROOT: /var/lib/gitea/git/repositories
      DISABLE_HTTP_GIT: "false"
      ENABLE_BASIC_AUTHENTICATION: "true"
      # --- Enable Package Registry ---
      GITEA__packages__ENABLED: "true"
      GITEA__packages__REGISTRY__ENABLED: "true"
      GITEA__packages__REGISTRY__STORAGE_TYPE: local
      GITEA__packages__REGISTRY__STORAGE_PATH: /data/registry
      # Optional: lock install after setup (เปลี่ยนเป็น true เมื่อจบ onboarding)
      GITEA__security__INSTALL_LOCK: "true"
    volumes:
      - /share/Container/gitea/backup:/backup
      - /share/Container/gitea/etc:/etc/gitea
      - /share/Container/gitea/lib:/var/lib/gitea
      # ให้ repo root ใช้จาก /share/dms-data/gitea_repos
      - /share/dms-data/gitea_repos:/var/lib/gitea/git/repositories
      - /share/dms-data/gitea_registry:/data/registry
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "3003:3000"  # HTTP (ไปหลัง NPM)
      - "2222:22"    # SSH สำหรับ git clone/push
    networks:
      - lcbp3
      - giteanet
```
