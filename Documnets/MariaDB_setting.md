# การติดตั้ง MAriaDB และ PHPMyAdmin ใน Docker

* user id ของ mariadb:

  * uid=0(root) gid=0(root) groups=0(root)

## กำหนดสิทธิ

```bash
chown -R 999:999 /share/Container/mariadb/init
chmod 755 /share/Container/mariadb/init
setfacl -R -m u:999:r-x /share/Container/mariadb/init
setfacl -R -d -m u:999:r-x /share/Container/mariadb/init

chown -R 33:33 /share/Container/pma/tmp
chmod 755 /share/Container/pma/tmp
setfacl -R -m u:33:rwx /share/Container/pma/tmp
setfacl -R -d -m u:33:rwx /share/Container/pma/tmp

chown -R 33:33 /share/dms-data/logs/pma
chmod 755 /share/dms-data/logs/pma
setfacl -R -m u:33:rwx /share/dms-data/logs/pma
setfacl -R -d -m u:33:rwx /share/dms-data/logs/pma

setfacl -R -m u:1000:rwx /share/Container/gitea
setfacl -R -m u:1000:rwx /share/dms-data/gitea_repos
setfacl -R -m u:1000:rwx /share/dms-data/gitea_registry
```

## เพิ่ม database & user สำหรับ Nginx Proxy Manager (NPM)

```bash
docker exec -it mariadb mysql -u root -p
  CREATE DATABASE npm;
  CREATE USER 'npm'@'%' IDENTIFIED BY 'npm';
  GRANT ALL PRIVILEGES ON npm.* TO 'npm'@'%';
  FLUSH PRIVILEGES;
```

## เพิ่ม database & user สำหรับ Gitea

```bash
docker exec -it mariadb mysql -u root -p
 CREATE DATABASE gitea CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';
 CREATE USER 'gitea'@'%' IDENTIFIED BY 'Center#2025';
 GRANT ALL PRIVILEGES ON gitea.* TO 'gitea'@'%';
 FLUSH PRIVILEGES;
```

## Docker file

```yml
# File: share/Container/mariadb/docker-compose.yml
# DMS Container v1_4_1 : แยก service และ folder,Application name: lcbp3-db, Servive: mariadb, pma
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

services:
  mariadb:
    <<: [*restart_policy, *default_logging]
    image: mariadb:11.8
    container_name: mariadb
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          cpus: "0.5"
          memory: 1G
    environment:
      MYSQL_ROOT_PASSWORD: "Center#2025"
      MYSQL_DATABASE: "lcbp3"
      MYSQL_USER: "center"
      MYSQL_PASSWORD: "Center#2025"
      TZ: "Asia/Bangkok"
    ports:
      - "3306:3306"
    volumes:
      - "/share/Container/mariadb/data:/var/lib/mysql"
      - "/share/Container/mariadb/my.cnf:/etc/mysql/conf.d/my.cnf:ro"
      - "/share/Container/mariadb/init:/docker-entrypoint-initdb.d:ro"
      - "/share/dms-data/mariadb/backup:/backup"
    healthcheck:
      test:
        ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -pCenter#2025 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 15
    networks:
      lcbp3: {}

  pma:
    <<: [*restart_policy, *default_logging]
    image: phpmyadmin:5-apache
    container_name: pma
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "0.25"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
      PMA_HOST: "mariadb"
      PMA_PORT: "3306"
      PMA_ABSOLUTE_URI: "https://pma.np-dms.work/"
      UPLOAD_LIMIT: "1G"
      MEMORY_LIMIT: "512M"
    ports:
      - "89:80"
    # expose:
    #  - "80"
    volumes:
      - "/share/Container/pma/config.user.inc.php:/etc/phpmyadmin/config.user.inc.php:ro"
      - "/share/Container/pma/zzz-custom.ini:/usr/local/etc/php/conf.d/zzz-custom.ini:ro"
      - "/share/Container/pma/tmp:/var/lib/phpmyadmin/tmp:rw"
      - "/share/dms-data/logs/pma:/var/log/apache2"
    depends_on:
      mariadb:
        condition: service_healthy
    networks:
      lcbp3: {}

networks:
  lcbp3:
    external: true
```
