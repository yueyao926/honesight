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
copy example.env .env

cd ..\frontend
copy example.env .env
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
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/lenscoach
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
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/lenscoach
JWT_SECRET_KEY=change-this-to-a-random-local-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
BACKEND_CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=uploads
AI_ANALYSIS_MODE=api
AI_ANALYSIS_ENABLED=true
AI_API_KEY=replace-with-your-own-api-key
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=doubao-seed-1-6-vision-250815
AI_TIMEOUT_SECONDS=45
ARK_API_KEY=replace-with-your-own-api-key
ARK_API_URL=https://ark.cn-beijing.volces.com/api/v3/responses
ARK_VISION_MODEL=doubao-seed-1-6-vision-250815
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
- AI 摄影教练闭环：选择目标风格和发布平台后，生成基础画面质量 benchmark、目标风格匹配度、风格判断、修图参数和平台发布建议
- 照片级 AI 对话：用户可以围绕某张作品继续追问调色、构图、平台发布和文案建议
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
11. 查看综合 benchmark、曝光/对焦/构图/色彩四维评分、权重、风格判断、修图参数和平台建议。
12. 在底部聊天框继续提问，例如“怎么调成日系清新风？”。

## AI 摄影教练功能说明

LensCoach 的核心能力不是“判断照片好坏”，而是基于用户选择的目标风格和发布平台，给出摄影成长建议：

- 基础画面质量 benchmark
- 目标风格匹配度
- 照片类型识别
- 当前风格判断
- Lightroom 与手机修图 App 参数建议
- 小红书、朋友圈、Instagram、作品集、商业约拍平台建议
- 围绕单张照片继续追问的 AI 对话

### Benchmark 评分模型

评分维度固定为四个：

- 曝光：是否过曝、欠曝，主体亮度是否合适，高光和阴影是否保留细节。
- 对焦：主体是否清晰，人像眼部/面部是否清楚，是否有明显虚焦。
- 构图：主体是否突出，画面是否杂乱，是否符合三分法、中心构图、引导线和留白。
- 色彩：白平衡是否自然，色彩是否统一，是否符合目标风格。

每个维度输出 0-100。综合 benchmark 会根据照片类型动态加权。

### 动态权重规则

- portrait：曝光 0.25，对焦 0.25，构图 0.35，色彩 0.15
- landscape：曝光 0.20，对焦 0.20，构图 0.25，色彩 0.35
- food：曝光 0.25，对焦 0.20，构图 0.25，色彩 0.30
- street：曝光 0.20，对焦 0.20，构图 0.35，色彩 0.25
- campus：曝光 0.25，对焦 0.20，构图 0.30，色彩 0.25
- product：曝光 0.25，对焦 0.30，构图 0.25，色彩 0.20
- night：曝光 0.35，对焦 0.25，构图 0.20，色彩 0.20
- general：四项均为 0.25

### Mock 模式与 API 模式

后端统一入口在 `backend/app/services/analyzer.py`。

- API 模式：`vision_analyzer.py` 调用火山方舟 OpenAI-compatible Responses API。
- Mock 模式：没有 API Key、`AI_ANALYSIS_MODE=mock`、图片不可读、API 调用失败或模型返回异常时，自动使用 `mock_analyzer.py`。

Mock 模式也会完整返回 benchmark、风格判断、平台建议、修图参数和聊天回复，因此本地开发不会被第三方 API 阻断。

### 火山方舟配置

在 `backend/.env` 中配置：

```env
AI_ANALYSIS_MODE=api
AI_API_KEY=replace-with-your-own-api-key
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=doubao-seed-1-6-vision-250815
AI_TIMEOUT_SECONDS=45
```

如果想强制 mock：

```env
AI_ANALYSIS_MODE=mock
```

### API Key 安全说明

- API Key 只允许存在于 `backend/.env`。
- 前端不会读取、保存或展示 API Key。
- `.env` 已被 `.gitignore` 忽略。
- 后端不会打印 API Key，也不会打印完整 base64 图片。

## 当前版本未实现

- 已预留并接入火山方舟豆包视觉模型；当前仍保留模板回退，避免 API 不可用时阻断主流程。
- 未实现云对象存储，当前图片保存在本地 `backend/uploads`。
- 未实现邮箱验证、找回密码、第三方登录。
- 未实现社区、点赞、评论、关注、支付等非核心功能。
- 未实现复杂标签体系，偏好多选字段当前用逗号分隔字符串保存。
- 当前 benchmark 是规则模型与视觉模型结构化输出结合，不是训练得到的评分模型。

## 后续开发计划

- 继续完善多模态提示词、结构化输出校验和 API 调用日志。
- 将上传图片迁移到 S3 / OSS / Supabase Storage。
- 增加作品系列、成长趋势和分析历史对比。
- 加入更细粒度的风格 preset 和平台化发布建议。
- 将偏好字段升级为 JSON 或独立标签表。
- 如果要训练真正的评分模型，优先替换 `backend/app/services/benchmark.py`，并保留 `analyzer.py` 作为统一编排入口。
