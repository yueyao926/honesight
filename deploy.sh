#!/bin/bash
set -e

cd ~/HoneSight

echo ">>> 拉取最新代码..."
git pull

echo ">>> 重新构建并启动..."
docker compose -f docker-compose.deploy.yml up -d --build

echo ">>> 清理旧镜像..."
docker image prune -f

echo ">>> 部署完成!"
docker compose -f docker-compose.deploy.yml ps
