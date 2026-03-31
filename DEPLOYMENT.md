# FxCRM Import Tool - Docker 部署指南

## 📋 前置要求

1. **服务器要求**
   - 操作系统: Linux (推荐 Ubuntu 20.04+)
   - 内存: 至少 2GB RAM
   - 磁盘: 至少 10GB 可用空间
   - 已安装 Docker 和 Docker Compose

2. **安装 Docker (如果未安装)**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # 安装 Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

## 🚀 快速部署

### 方法一：使用部署脚本（推荐）

1. **上传项目到服务器**
   ```bash
   # 在本地打包项目
   tar -czf fxcrm-tool.tar.gz .
   
   # 上传到服务器
   scp fxcrm-tool.tar.gz user@your-server:/home/user/
   
   # 在服务器上解压
   ssh user@your-server
   mkdir -p ~/fxcrm-tool
   tar -xzf fxcrm-tool.tar.gz -C ~/fxcrm-tool
   cd ~/fxcrm-tool
   ```

2. **运行部署脚本**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **访问应用**
   - 打开浏览器访问: `http://your-server-ip:3000`

### 方法二：手动部署

1. **构建镜像**
   ```bash
   docker-compose build
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

3. **查看日志**
   ```bash
   docker-compose logs -f
   ```

## 🔧 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新应用
git pull  # 或重新上传代码
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🌐 配置域名和 HTTPS（可选）

### 使用 Nginx 反向代理

1. **安装 Nginx**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **配置 Nginx**
   创建配置文件 `/etc/nginx/sites-available/fxcrm-tool`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **启用配置**
   ```bash
   sudo ln -s /etc/nginx/sites-available/fxcrm-tool /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **配置 HTTPS (使用 Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 📊 监控和维护

### 查看资源使用
```bash
docker stats fxcrm-import-tool
```

### 备份数据（如果有持久化数据）
```bash
docker-compose exec fxcrm-tool tar -czf /tmp/backup.tar.gz /app/data
docker cp fxcrm-import-tool:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

### 清理旧镜像
```bash
docker image prune -a
```

## 🐛 故障排查

### 容器无法启动
```bash
# 查看详细日志
docker-compose logs

# 检查端口占用
sudo netstat -tulpn | grep 3000
```

### 应用无法访问
1. 检查防火墙设置
   ```bash
   sudo ufw allow 3000
   ```

2. 检查容器是否运行
   ```bash
   docker ps
   ```

3. 检查容器健康状态
   ```bash
   docker inspect fxcrm-import-tool | grep Health
   ```

## 🔄 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建并部署
./deploy.sh
```

## 📝 环境变量配置（可选）

如需配置环境变量，在 `docker-compose.yml` 中添加:
```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - CUSTOM_VAR=value
```

## 💡 性能优化建议

1. **限制容器资源**
   在 `docker-compose.yml` 中添加:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

2. **启用日志轮转**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

## 📞 技术支持

如遇到问题，请检查:
1. Docker 和 Docker Compose 版本
2. 服务器内存和磁盘空间
3. 容器日志: `docker-compose logs -f`
