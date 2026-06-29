FROM n8nio/n8n:2.16.1

USER root

# Fix Debian 10 Buster EOL package repositories
RUN echo "deb http://archive.debian.org/debian buster main" > /etc/apt/sources.list && \
    echo "deb http://archive.debian.org/debian-security buster/updates main" >> /etc/apt/sources.list && \
    apt-get update -y && \
    apt-get install -y poppler-utils python3 python3-pip

USER node
