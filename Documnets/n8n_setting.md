# การติดตั้ง n8n ใน Docker

* user id ของ gites:

  * uid=1000(node) gid=1000(node) groups=1000(node)

## กำหนดสิทธิ

```bash
# สำหรับ n8n volumes
chown -R 1000:1000 /share/Container/n8n
chmod -R 755 /share/Container/n8n
```

## Docker file

```yml
# File: share/Container/n8n/docker-compose.yml
# DMS Container v1_4_1 แยก service และ folder, Application name:n8n service n8n
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"
services:
  n8n:
    <<: [*restart_policy, *default_logging]
    image: n8nio/n8n:latest
    container_name: n8n
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2G
        reservations:
          cpus: "0.25"
          memory: 512M
    environment:
      TZ: "Asia/Bangkok"
      NODE_ENV: "production"
      # N8N_PATH: "/n8n/"
      N8N_PUBLIC_URL: "https://n8n.np-dms.work/"
      WEBHOOK_URL: "https://n8n.np-dms.work/"
      N8N_EDITOR_BASE_URL: "https://n8n.np-dms.work/"
      N8N_PROTOCOL: "https"
      N8N_HOST: "n8n.np-dms.work"
      N8N_PORT: 5678
      N8N_PROXY_HOPS: "1"
      N8N_DIAGNOSTICS_ENABLED: 'false'
      N8N_SECURE_COOKIE: 'true'
      N8N_ENCRYPTION_KEY: "9AAIB7Da9DW1qAhJE5/Bz4SnbQjeAngI"
      N8N_BASIC_AUTH_ACTIVE: 'true'
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: Center#2025
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true'
      GENERIC_TIMEZONE: "Asia/Bangkok"
      DB_TYPE: mysqldb
      DB_MYSQLDB_DATABASE: "n8n"
      DB_MYSQLDB_USER: "center"
      DB_MYSQLDB_PASSWORD: "Center#2025"
      DB_MYSQLDB_HOST: "mariadb"
      DB_MYSQLDB_PORT: 3306

    ports:
      - "5678:5678"
    networks:
      lcbp3: {}
    volumes:
      - "/share/Container/n8n:/home/node/.n8n"
      - "/share/Container/n8n/cache:/home/node/.cache"
      - "/share/Container/n8n/scripts:/scripts"
      - "/share/Container/n8n/data:/data"
      - "/var/run/docker.sock:/var/run/docker.sock"

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:5678/"]
      # test: ["CMD", "curl", "-f", "http://127.0.0.1:5678/ || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 30

networks:
  lcbp3:
    external: true
```
