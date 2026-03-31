# 快速更新服务器 Docker 容器

## 方法一：使用部署脚本（推荐）

如果你的代码已经在服务器上，直接运行：

```bash
# SSH 登录到服务器
ssh user@your-server

# 进入项目目录
cd ~/fxcrm-tool

# 运行部署脚本（会自动停止旧容器、重新构建、启动新容器）
./deploy.sh
```

## 方法二：从本地推送更新

### 步骤 1: 在本地打包最新代码

```bash
# 在项目根目录
cd /Users/zhebinliu/.gemini/antigravity/scratch/fxcrm-import-tool

# 打包项目（排除 node_modules 和 .next）
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czf fxcrm-tool-update.tar.gz .
```

### 步骤 2: 上传到服务器

```bash
# 上传到服务器
scp fxcrm-tool-update.tar.gz user@your-server:/home/user/

# 或者使用 rsync（更快，只传输变化的文件）
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
  ./ user@your-server:/home/user/fxcrm-tool/
```

### 步骤 3: 在服务器上更新

```bash
# SSH 登录服务器
ssh user@your-server

# 如果使用 tar 包
cd ~
tar -xzf fxcrm-tool-update.tar.gz -C fxcrm-tool/
cd fxcrm-tool

# 重新部署
./deploy.sh
```

## 方法三：手动更新（更精细控制）

```bash
# SSH 登录服务器
ssh user@your-server
cd ~/fxcrm-tool

# 1. 停止当前容器
docker-compose down

# 2. 重新构建镜像（--no-cache 确保使用最新代码）
docker-compose build --no-cache

# 3. 启动新容器
docker-compose up -d

# 4. 查看日志确认启动成功
docker-compose logs -f
```

## 验证更新

```bash
# 检查容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 测试配置保存功能
# 1. 打开浏览器访问 http://your-server-ip:3000
# 2. 修改配置（如 App ID）
# 3. 刷新页面，确认配置保存

# 测试数据更新功能
# 1. 在数据更新页面查询一条记录
# 2. 修改字段值
# 3. 点击提交
# 4. 在 FxCRM 中验证数据是否真的更新了
```

## 快捷命令脚本

创建一个 `quick-update.sh` 在本地：

```bash
#!/bin/bash
# 快速更新服务器脚本

SERVER="user@your-server"
PROJECT_DIR="/home/user/fxcrm-tool"

echo "📦 同步代码到服务器..."
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
  ./ $SERVER:$PROJECT_DIR/

echo "🔄 在服务器上重新部署..."
ssh $SERVER "cd $PROJECT_DIR && ./deploy.sh"

echo "✅ 更新完成！"
```

使用方法：
```bash
chmod +x quick-update.sh
./quick-update.sh
```

## 故障排查

如果更新后出现问题：

```bash
# 查看容器日志
docker-compose logs -f

# 查看构建日志
docker-compose build

# 完全清理后重建
docker-compose down -v
docker system prune -a
./deploy.sh
```
