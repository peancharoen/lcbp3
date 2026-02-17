# การติดตั้ง MAriaDB และ PHPMyAdmin ใน Docker

* user id ของ mariadb:

  * uid=0(root) gid=0(root) groups=0(root)

## กำหนดสิทธิ

```bash

chown -R 999:999 /share/np-dms/mariadb
chmod -R 755 /share/np-dms/mariadb
setfacl -R -m u:999:rwx /share/np-dms/mariadb
setfacl -R -d -m u:999:rwx /share/np-dms/mariadb

chown -R 999:999 /share/np-dms/mariadb/init
chmod 755 /share/np-dms/mariadb/init
setfacl -R -m u:999:r-x /share/np-dms/mariadb/init
setfacl -R -d -m u:999:r-x /share/np-dms/mariadb/init

chown -R 33:33 /share/np-dms/pma/tmp
chmod 755 /share/np-dms/pma/tmp
setfacl -R -m u:33:rwx /share/np-dms/pma/tmp
setfacl -R -d -m u:33:rwx /share/np-dms/pma/tmp

chown -R 33:33 /share/dms-data/logs/pma
chmod 755 /share/dms-data/logs/pma
setfacl -R -m u:33:rwx /share/dms-data/logs/pma
setfacl -R -d -m u:33:rwx /share/dms-data/logs/pma

setfacl -R -m u:1000:rwx /share/nap-dms/gitea
setfacl -R -m u:1000:rwx /share/nap-dms/gitea/gitea_repos
setfacl -R -m u:1000:rwx /share/nap-dms/gitea/gitea_registry
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

docker exec -it mariadb mysql -u root -p
  CREATE USER 'exporter'@'%' IDENTIFIED BY 'Center#2025' WITH MAX_USER_CONNECTIONS 3;
  GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
  FLUSH PRIVILEGES;
```

## Docker file

```yml
# File: share/nap-dms/mariadb/docker-compose.yml
# DMS Container v1_7_0 : ย้าย folder ไปที่ share/nap-dms/
# Application name: lcbp3-db, Servive: mariadb, pma
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
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/mariadb/data:/var/lib/mysql"
      - "/share/np-dms/mariadb/my.cnf:/etc/mysql/conf.d/my.cnf:ro"
      - "/share/np-dms/mariadb/init:/docker-entrypoint-initdb.d:ro"
      - "/share/dms-data/mariadb/backup:/backup"
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

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
    networks:
      - lcbp3
    # expose:
    #  - "80"
    volumes:
      - "/share/np-dms/pma/config.user.inc.php:/etc/phpmyadmin/config.user.inc.php:ro"
      - "/share/np-dms/pma/zzz-custom.ini:/usr/local/etc/php/conf.d/zzz-custom.ini:ro"
      - "/share/np-dms/pma/tmp:/var/lib/phpmyadmin/tmp:rw"
      - "/share/dms-data/logs/pma:/var/log/apache2"
    depends_on:
      mariadb:
        condition: service_healthy

networks:
  lcbp3:
    external: true

# chown -R 999:999 /share/np-dms/mariadb/init
# chmod 755 /share/np-dms/mariadb/init
# setfacl -R -m u:999:r-x /share/np-dms/mariadb/init
# setfacl -R -d -m u:999:r-x /share/np-dms/mariadb/init

# chown -R 33:33 /share/np-dms/pma/tmp
# chmod 755 /share/np-dms/pma/tmp
# setfacl -R -m u:33:rwx /share/np-dms/pma/tmp
# setfacl -R -d -m u:33:rwx /share/np-dms/pma/tmp

# chown -R 33:33 /share/dms-data/logs/pma
# chmod 755 /share/dms-data/logs/pma
# setfacl -R -m u:33:rwx /share/dms-data/logs/pma
# setfacl -R -d -m u:33:rwx /share/dms-data/logs/pma

# setfacl -R -m u:1000:rwx /share/Container/gitea
# setfacl -R -m u:1000:rwx /share/dms-data/gitea_repos
# setfacl -R -m u:1000:rwx /share/dms-data/gitea_registry

# docker exec -it mariadb mysql -u root -p
#   CREATE DATABASE npm;
#   CREATE USER 'npm'@'%' IDENTIFIED BY 'npm';
#   GRANT ALL PRIVILEGES ON npm.* TO 'npm'@'%';
#   FLUSH PRIVILEGES;

```
