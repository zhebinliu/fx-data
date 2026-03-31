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

# 构建新镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build --no-cache

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
