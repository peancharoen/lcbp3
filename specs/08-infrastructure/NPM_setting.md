# การติดตั้ง Nginx Proxy Manager (NPM) ใน Docker

* ค่าเริ่มต้นคือ:Email: [admin@example.com] Password: changeme

* user id ของ NPM:

  * uid=0(root) gid=0(root) groups=0(root)

---

## กำหนดสิทธิ

```bash
# ตรวจสอบ  user id ของ NPM
docker exec -it npm id
chown -R 0:0 /share/Container/npm
setfacl -R -m u:0:rwx /share/Container/npm
```

## Note: Configurations

| Domain Names                   | Forward Hostname | IP Forward Port | Cache Assets | Block Common Exploits | Websockets | Force SSL | HTTP/2 | SupportHSTS Enabled |
| :----------------------------- | :--------------- | :-------------- | :----------- | :-------------------- | :--------- | :-------- | :----- | :------------------ |
| backend.np-dms.work            | backend          | 3000            | [ ]          | [x]                   | [ ]        | [x]       | [x]    | [ ]                 |
| lcbp3.np-dms.work              | frontend         | 3000            | [x]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| db.np-dms.work                 | mariadb          | 3306            | [x]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| git.np-dms.work                | gitea            | 3000            | [x]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| n8n.np-dms.work                | n8n              | 5678            | [x]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| chat.np-dms.work               | rocketchat       | 3000            | [x]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| npm.np-dms.work                | npm              | 81              | [ ]          | [x]                   | [x]        | [x]       | [x]    | [ ]                 |
| pma.np-dms.work                | pma              | 80              | [x]          | [x]                   | [ ]        | [x]       | [x]    | [ ]                 |
| np-dms.work, [www.np-dms.work] | localhost        | 80              | [x]          | [x]                   | [ ]        | [x]       | [x]    | [ ]                 |

## Docker file

```yml
# File: share/np-dms/npm/docker-compose-npm.yml
# DMS Container v1_7_0 : ย้าย folder ไปที่ share/np-dms/
# Application name: lcbp3-npm, Servive:npm
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"
services:
  npm:
    <<: [*restart_policy, *default_logging]
    image: jc21/nginx-proxy-manager:latest
    container_name: npm
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "1.0" # 50% CPU
          memory: 512M
    ports:
      - "80:80" # HTTP
      - "443:443" # HTTPS
      - "81:81" # NPM Admin UI
    environment:
      TZ: "Asia/Bangkok"
      DB_MYSQL_HOST: "mariadb"
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
      # Uncomment this if IPv6 is not enabled on your host
      DISABLE_IPV6: "true"
    networks:
      - lcbp3
      - giteanet
    volumes:
      - "/share/np-dms/npm/data:/data"
      - "/share/dms-data/logs/npm:/data/logs" # <-- เพิ่ม logging volume
      - "/share/np-dms/npm/letsencrypt:/etc/letsencrypt"
      - "/share/np-dms/npm/custom:/data/nginx/custom" # <-- สำคัญสำหรับ http_top.conf
      # - "/share/Container/lcbp3/npm/landing:/data/landing:ro"
  landing:
   image: nginx:1.27-alpine
   container_name: landing
   restart: unless-stopped
   volumes:
     - "/share/np-dms/npm/landing:/usr/share/nginx/html:ro"
   networks:
     - lcbp3
networks:
  lcbp3:
    external: true
  giteanet:
    external: true
    name: gitnet




```
