# LensCoach

LensCoach 是一个面向摄影新手的 AI 摄影成长教练 MVP。用户可以注册登录、设置摄影偏好、上传照片建立个人作品集，并获得基于目标风格和发布平台的模板化摄影建议报告。

当前版本不接入真实 AI API，先用规则和模板分析实现完整产品闭环。

## 技术栈

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL
- Auth: JWT + bcrypt password hash
- Upload: FastAPI static uploads
- Vision Model: Volcengine Ark Responses API, with template fallback

## 本地开发准备

需要安装：

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

复制环境变量：

```bash
cd backend
copy .env.example .env

cd ..\frontend
copy .env.example .env
```

## 如何启动 PostgreSQL

如果你本地已安装 PostgreSQL，可以使用系统服务启动 PostgreSQL。

Windows 常见方式：

```bash
net start postgresql-x64-14
```

如果服务名不同，请在 Windows 服务管理器中查看实际名称。

## 如何创建数据库 lenscoach

进入 PostgreSQL：

```bash
psql -U postgres
```

创建数据库：

```sql
CREATE DATABASE lenscoach;
```

退出：

```sql
\q
```

确保 `backend/.env` 中的 `DATABASE_URL` 与本地 PostgreSQL 密码一致：

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lenscoach
```

## 如何启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

后端默认地址：

```text
http://localhost:8000
```

API 文档：

```text
http://localhost:8000/docs
```

## 如何运行数据库迁移

```bash
cd backend
alembic upgrade head
```

创建新迁移时：

```bash
alembic revision --autogenerate -m "describe changes"
```

## 如何启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:5173
```

## 环境变量说明

### backend/.env

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lenscoach
JWT_SECRET_KEY=please-change-this
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
BACKEND_CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=uploads
ARK_API_KEY=your-ark-api-key
ARK_API_URL=https://ark.cn-beijing.volces.com/api/v3/responses
ARK_VISION_MODEL=doubao-seed-1-6-vision-250815
AI_ANALYSIS_ENABLED=true
```

### frontend/.env

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 当前已完成功能

- 用户注册、登录、JWT 鉴权
- 密码 hash 保存
- 获取当前用户信息
- 用户摄影偏好创建、读取、更新
- 作品集 CRUD
- 图片上传到 `backend/uploads`
- 静态访问上传图片
- 模板化照片分析报告
- 豆包视觉模型识图分析，未配置或调用失败时自动回退模板报告
- 获取作品最新分析结果
- React 前端登录保护
- 首页、注册、登录、onboarding、dashboard、settings、作品集、上传作品、作品详情页面
- 前端 API client 自动携带 token，遇到 401 自动退出登录

## 默认测试流程

1. 启动 PostgreSQL，并创建 `lenscoach` 数据库。
2. 在 `backend` 中安装依赖并执行 `alembic upgrade head`。
3. 启动后端：`uvicorn app.main:app --reload`。
4. 在 `frontend` 中安装依赖并执行 `npm run dev`。
5. 打开 `http://localhost:5173`。
6. 注册账号。
7. 登录后进入 dashboard。
8. 进入 onboarding 填写摄影偏好。
9. 上传第一张作品。
10. 在作品详情页点击“生成分析报告”。
11. 查看总体评价、构图建议、光线建议、色彩建议和修图参数。

## 当前版本未实现

- 已预留并接入火山方舟豆包视觉模型；当前仍保留模板回退，避免 API 不可用时阻断主流程。
- 未实现云对象存储，当前图片保存在本地 `backend/uploads`。
- 未实现邮箱验证、找回密码、第三方登录。
- 未实现社区、点赞、评论、关注、支付等非核心功能。
- 未实现复杂标签体系，偏好多选字段当前用逗号分隔字符串保存。

## 后续开发计划

- 继续完善多模态提示词、结构化输出校验和 API 调用日志。
- 将上传图片迁移到 S3 / OSS / Supabase Storage。
- 增加作品系列、成长趋势和分析历史对比。
- 加入更细粒度的风格 preset 和平台化发布建议。
- 将偏好字段升级为 JSON 或独立标签表。
