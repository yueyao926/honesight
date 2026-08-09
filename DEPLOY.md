# LensCoach 服务器部署指南

## 前置条件

- 服务器已安装 Docker 和 Docker Compose
- 服务器已有 PostgreSQL 数据库
- 服务器已安装 Git（用来拉取代码）

---

## 第一步：找到服务器上 PostgreSQL 的连接信息

SSH 登录到你的服务器，依次执行以下命令：

### 1. 查看 PostgreSQL 是否在运行

```bash
sudo systemctl status postgresql
```

### 2. 找到 PostgreSQL 的监听地址和端口

```bash
sudo -u postgres psql -c "SHOW listen_addresses;"
sudo -u postgres psql -c "SHOW port;"
```

> 默认端口是 `5432`，默认监听地址是 `localhost` 或 `127.0.0.1`。

### 3. 查看已有的数据库列表

```bash
sudo -u postgres psql -l
```

> 看看有没有现成的 `lenscoach` 数据库，如果没有就需要创建一个。

### 4. 查看 PostgreSQL 用户列表

```bash
sudo -u postgres psql -c "\du"
```

### 5. 创建数据库和密码（如果没有的话）

```bash
# 进入 PostgreSQL 命令行
sudo -u postgres psql
```

```sql
-- 创建数据库
CREATE DATABASE lenscoach;

-- 创建用户并设置密码（如果还没有的话）
CREATE USER lenscoach WITH PASSWORD '你设置的密码';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE lenscoach TO lenscoach;

-- 退出
\q
```

### 6. 确定连接地址

根据上面的结果，拼出你的数据库连接地址，格式为：

```
postgresql://用户名:密码@主机地址:端口/数据库名
```

例如：
```
# 本机 PostgreSQL，用户 postgres，密码 mypass123
postgresql://postgres:mypass123@localhost:5432/lenscoach

# 或者用 Docker 部署的 PostgreSQL 通过内网 IP 访问
postgresql://lenscoach:mypass123@172.17.0.1:5432/lenscoach
```

> **注意**：如果后端用 Docker 跑，但是 PostgreSQL 在宿主机上，`localhost` 在容器里指向的是容器自己，不是宿主机。
> 这种情况下地址应该写成：
> - Linux 服务器：`host.docker.internal` 或 `172.17.0.1`（Docker 默认网桥）
> - 或者用服务器的内网 IP（如 `10.0.0.5`、`192.168.1.100`）

---

## 第二步：把项目上传到服务器

在你**本地电脑**上运行：

```bash
# 把项目上传到服务器（替换成你的服务器地址和路径）
scp -r C:\Users\31860\Desktop\lenscoach 用户名@你的服务器IP:/home/用户名/lenscoach
```

或者用 Git：

在服务器上：
```bash
git clone <你的仓库地址> ~/lenscoach
cd ~/lenscoach
```

---

## 第三步：配置环境变量

在服务器上的项目目录里：

```bash
cd ~/lenscoach

# 复制环境变量模板
cp server.env.example .env
```

然后编辑 `.env` 文件：

```bash
nano .env
```

填入你第一步找到的信息：

```env
# 必填 - 用你第一步拼出来的数据库地址
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/lenscoach

# 必填 - 用下面的命令生成一个随机密钥
JWT_SECRET_KEY=你生成的随机密钥

# 前端端口
PORT=80

# 你的服务器 IP 或域名，比如 http://123.45.67.89 或 http://lenscoach.com
CORS_ORIGINS=http://你的服务器IP或域名

# AI 分析（可选，不填也能用 mock 模式）
AI_API_KEY=
ARK_API_KEY=
```

生成 JWT 密钥：
```bash
openssl rand -hex 32
```

---

## 第四步：启动服务

```bash
cd ~/lenscoach

# 构建镜像并启动
docker compose -f docker-compose.server.yml up -d --build
```

这个命令会：
1. 构建后端 FastAPI 镜像
2. 构建前端 Nginx 镜像（React 编译后由 Nginx 托管）
3. 启动两个容器：`lenscoach-backend-1` + `lenscoach-frontend-1`

---

## 第五步：检查是否成功

### 查看容器状态

```bash
docker compose -f docker-compose.server.yml ps
```

两个服务都显示 `Up` 就是正常的。

### 查看日志

```bash
# 看所有服务日志
docker compose -f docker-compose.server.yml logs -f

# 只看后端日志
docker compose -f docker-compose.server.yml logs -f backend

# 只看前端日志
docker compose -f docker-compose.server.yml logs -f frontend
```

### 测试后端

```bash
curl http://localhost:8000/health
```

返回 `{"status":"ok"}` 表示后端正常运行。

### 测试前端

在浏览器里打开 `http://你的服务器IP`，能看到 LensCoach 的登录页面就成功了。

---

## 常用命令

```bash
# 重新构建（代码更新后）
docker compose -f docker-compose.server.yml up -d --build

# 停止
docker compose -f docker-compose.server.yml down

# 重启
docker compose -f docker-compose.server.yml restart

# 查看日志
docker compose -f docker-compose.server.yml logs -f --tail=50

# 进入后端容器调试
docker compose -f docker-compose.server.yml exec backend bash
```

---

## 如果遇到问题

### 1. 后端连不上数据库

常见原因是数据库地址不对。因为后端在 Docker 容器里运行，如果 PostgreSQL 在宿主机上，`localhost` 指的是容器自身。

解决方法：把 `DATABASE_URL` 里的 `localhost` 改成以下之一：
- `host.docker.internal`（部分 Linux 需要额外配置）
- `172.17.0.1`（Docker 默认网桥地址）
- 服务器的内网 IP（`ip addr` 查看）

### 2. 数据库不存在

```bash
sudo -u postgres psql -c "CREATE DATABASE lenscoach;"
```

### 3. 数据库密码不对

```bash
# 重置 postgres 用户密码
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '新密码';"
```

### 4. pg_hba.conf 不允许连接

```bash
# 找到 pg_hba.conf 位置
sudo -u postgres psql -c "SHOW hba_file;"

# 编辑它
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

确保有这一行（允许本地连接）：
```
host    all             all             172.17.0.0/16           md5
```

然后重启 PostgreSQL：
```bash
sudo systemctl restart postgresql
```

### 5. 端口 80 被占用

```bash
# 修改 .env 里的 PORT 为其他端口，如 8080
PORT=8080
```

然后重新构建：
```bash
docker compose -f docker-compose.server.yml up -d --build
```

浏览器打开 `http://你的服务器IP:8080`。

---

> 有问题把 `docker compose -f docker-compose.server.yml logs` 的报错贴给我，我帮你分析。
