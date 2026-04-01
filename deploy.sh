#!/bin/bash

# FxCRM Import Tool - Docker 部署脚本

echo "🚀 开始部署 FxCRM Import Tool..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 停止并删除旧容器
echo "🛑 停止旧容器..."
docker-compose down

# 清理 Docker 构建缓存和悬空镜像，避免磁盘堆满
echo "🧹 清理 Docker 构建缓存..."
docker builder prune -f
docker image prune -f

# 构建新镜像
echo "🔨 构建 Docker 镜像..."
if ! docker-compose build --no-cache; then
    echo "❌ Docker 镜像构建失败！请检查上方日志。"
    exit 1
fi

# 修复文件权限问题：提前在宿主机建立 data 目录并赋予与容器内 nextjs 用户(UID 1001)相匹配的权限，避免 EACCESS 报错
echo "🔐 配置宿主机持久化目录权限..."
mkdir -p data
sudo chown -R 1001:1001 data

# 启动容器
echo "▶️  启动容器..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查容器状态
if docker ps | grep -q fxcrm-import-tool; then
    echo "✅ 部署成功！"
    echo "📍 访问地址: http://localhost:3000"
    echo "📊 查看日志: docker-compose logs -f"
    echo "🛑 停止服务: docker-compose down"
else
    echo "❌ 部署失败，请检查日志: docker-compose logs"
    exit 1
fi
