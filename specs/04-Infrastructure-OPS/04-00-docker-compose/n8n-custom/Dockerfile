FROM n8nio/n8n:latest-debian

USER root

# Fix Debian 10 Buster EOL package repositories
RUN echo "deb http://archive.debian.org/debian buster main" > /etc/apt/sources.list && \
    echo "deb http://archive.debian.org/debian-security buster/updates main" >> /etc/apt/sources.list && \
    apt-get update -y && \
    apt-get install -y poppler-utils

USER node
