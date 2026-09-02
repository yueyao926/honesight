# HoneSight

项目完整的架构、接口、数据模型、配置和部署说明见：[技术文档](docs/TECHNICAL_DOCUMENTATION.md)。

HoneSight 是一个面向摄影新手的 AI 摄影成长教练 MVP。用户可以注册登录、设置摄影偏好、上传照片建立个人作品集，并获得基于目标风格和发布平台的模板化摄影建议报告。

当前版本不接入真实 AI API，先用规则和模板分析实现完整产品闭环。

## 技术栈

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL
- Auth: short-lived JWT + revocable refresh-cookie session + bcrypt password hash
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

## 如何创建数据库 HoneSight

进入 PostgreSQL：

```bash
psql -U postgres
```

创建数据库：

```sql
CREATE DATABASE HoneSight;
```

退出：

```sql
\q
```

确保 `backend/.env` 中的 `DATABASE_URL` 与本地 PostgreSQL 密码一致：

```env
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/HoneSight
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
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/HoneSight
JWT_SECRET_KEY=change-this-to-a-random-local-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=14
REFRESH_TOKEN_REUSE_GRACE_SECONDS=30
SESSION_COOKIE_NAME=lenscoach_refresh
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
SESSION_COOKIE_DOMAIN=
BACKEND_CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=uploads
AI_ANALYSIS_MODE=api
AI_ANALYSIS_ENABLED=true
AI_API_KEY=replace-with-your-own-api-key
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=doubao-seed-1-6-vision-250815
AI_FAST_MODEL=doubao-seed-2-0-lite-260215
AI_FAST_TIMEOUT_SECONDS=8
AI_PRACTICE_MODEL=
AI_TIMEOUT_SECONDS=45
# 可选；仅在 AI 服务商可公网访问 /api/upload/ai-media 时填写，否则留空
AI_PUBLIC_API_BASE_URL=
ANALYSIS_CACHE_TTL_HOURS=720
# 未保存的分析图 72 小时、生成图 7 天、练习周期结束后 30 天自动清理
UPLOAD_CLEANUP_ENABLED=true
UPLOAD_CLEANUP_INTERVAL_HOURS=12
ANALYSIS_IMAGE_RETENTION_HOURS=72
GENERATED_IMAGE_RETENTION_HOURS=168
PRACTICE_IMAGE_RETENTION_DAYS=30
ORPHAN_IMAGE_RETENTION_HOURS=72
ARK_API_KEY=replace-with-your-own-api-key
ARK_API_URL=https://ark.cn-beijing.volces.com/api/v3/responses
ARK_VISION_MODEL=doubao-seed-1-6-vision-250815
```

### frontend/.env

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 登录会话

- 访问 JWT 默认有效 15 分钟，只保存在浏览器内存中；API 遇到过期令牌会自动刷新并重试一次。
- 刷新会话默认固定有效 14 天，保存在 `HttpOnly`、`SameSite=Lax` 的持久 Cookie 中，因此关闭浏览器后仍可恢复登录。
- 刷新令牌每次使用都会轮换；旧令牌仅保留默认 30 秒的并发宽限期，超期复用会撤销该会话。
- 主动登出会在服务端撤销会话并删除 Cookie，已签发的访问 JWT 也会因会话已撤销而失效。
- 本地 HTTP 使用 `SESSION_COOKIE_SECURE=false`；HTTPS 生产环境必须设为 `true`。若跨站部署必须使用 `SameSite=None`，配置校验也会要求同时启用 `Secure`。

## 当前已完成功能

- 用户注册、登录、服务端可撤销的 JWT 会话鉴权
- 密码 hash 保存
- 获取当前用户信息
- 用户摄影偏好创建、读取、更新
- 作品集 CRUD
- 图片上传到 `backend/uploads`
- 图片按分析、练习、作品集和社区用途分目录保存；后台定时清理过期且未被引用的文件
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

1. 启动 PostgreSQL，并创建 `HoneSight` 数据库。
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

HoneSight 的核心能力不是“判断照片好坏”，而是基于用户选择的目标风格和发布平台，给出摄影成长建议：

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

- API 模式：`vision_analyzer.py` 调用配置好的AI视觉服务。系统遵循 OpenAI-compatible 接口规范，您可自由接入任何满足该规范的模型服务商（例如火山方舟、阿里云百炼、腾讯混元、OpenAI、Google 等），具体配置见下文环境变量。
- Mock 模式：没有 API Key、`AI_ANALYSIS_MODE=mock`、图片不可读、API 调用失败或模型返回异常时，自动使用 `mock_analyzer.py`。

Mock 模式也会完整返回 benchmark、风格判断、平台建议、修图参数和聊天回复，因此本地开发不会被第三方 API 阻断。

### 火山方舟配置

在 `backend/.env` 中配置：

```env
# 运行模式：api 或 mock
AI_ANALYSIS_MODE=api

# 服务商 API 密钥（请替换为您实际使用的服务商密钥）
AI_API_KEY=replace-with-your-own-api-key

# 接口 Base URL（此处为火山方舟示例，您可换为其他服务商地址）
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 视觉模型（示例：豆包视觉，您可按需替换为 GPT-4o、Qwen-VL 等）
AI_MODEL=doubao-seed-1-6-vision-250815

# 轻量级模型（用于简单分类或快速响应，可按需替换）
AI_FAST_MODEL=doubao-seed-2-0-lite-260215

# 超时控制（秒）
AI_FAST_TIMEOUT_SECONDS=8
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

## 每日摄影灵感

首页“今日摄影灵感”每天返回 3～4 张合规摄影作品。同一用户同一天的结果写入数据库，因此刷新后顺序不变；近 14 天作品优先排除。匿名访客共享当天公共推荐，登录用户会结合摄影偏好评分并可收藏。

在 `backend/.env` 中配置（缺少 Key 时应用仍可正常启动，只展示数据库已有内容）：

```env
UNSPLASH_ACCESS_KEY=
OPENVERSE_CLIENT_ID=
OPENVERSE_CLIENT_SECRET=
INSPIRATION_DAILY_COUNT=4
INSPIRATION_RECENT_EXCLUSION_DAYS=14
INSPIRATION_ADMIN_EMAILS=admin@example.com
```

Unsplash Access Key 可在 Unsplash Developers 创建应用后获取。Openverse 凭据可选；未认证公共 API 仍可调用，但需遵守其限流策略。任何真实 Key 都只能写入 `backend/.env`，不得提交。

先执行迁移：

```bash
cd backend
alembic upgrade head
```

升级摄影灵感文案规则后，先预览需要回填的外部图库记录，再显式执行回填：

```bash
python -m app.scripts.backfill_inspiration_content --dry-run
python -m app.scripts.backfill_inspiration_content --batch-size 200
```

回填命令只更新旧版本的 Unsplash 和 Openverse 文案，不修改社区投稿；完成后会清除当天推荐缓存，使下一次首页请求按新版规则重新生成推荐理由。命令按版本执行，可安全重复运行。

使用 `INSPIRATION_ADMIN_EMAILS` 中的账号登录，在 Swagger (`/docs`) 为请求填写 Bearer Token 后调用：

- `POST /inspirations/admin/sync/unsplash`：同步 Unsplash，来源信息完整的作品直接合规入池。
- `POST /inspirations/admin/sync/openverse`：同步 CC0、PDM、CC BY、CC BY-SA 候选；新数据一律为待审核。
- `PATCH /inspirations/admin/{photo_id}/moderation`：人工确认许可证并批准或拒绝 Openverse 作品。

用户接口包括 `GET /inspirations/today`、`GET /inspirations/{id}`、`PUT/DELETE /inspirations/{id}/favorite` 和 `GET /inspirations/favorites`。Openverse 只有 `license_verified=true`、`moderation_status=approved` 且许可证在允许列表中才会推荐；社区作品还必须公开、明确同意推荐且授权未撤回。

### 长期图片池同步

生产环境默认启用轻量后台同步任务：后端启动 15 秒后按 7 个主题各同步 20 张，形成约 140 张候选池；之后每 168 小时补充一次最新结果。Unsplash 搜索支持分页，单主题最多同步 200 张，数据库通过 `source_type + external_id` 唯一约束去重。现有用户推荐仍优先排除最近 14 天出现过的作品。

```env
INSPIRATION_SYNC_ENABLED=true
INSPIRATION_SYNC_INTERVAL_HOURS=168
INSPIRATION_SYNC_PER_TOPIC=20
INSPIRATION_SYNC_STARTUP_DELAY_SECONDS=15
INSPIRATION_SYNC_TOPICS=portrait,landscape,street photography,architecture,still life,night photography,animals
```

如需立即补充，可由管理员调用 `POST /inspirations/admin/sync-all`。请求体可留空使用默认配置，也可指定主题和每主题数量：

```json
{
  "topics": ["portrait", "landscape", "street photography", "architecture", "still life", "night photography", "animals"],
  "per_topic": 20
}
```

Demo API 默认每小时请求额度较低。默认初始同步仅需 7 次请求；请避免把同步间隔设置得过短。
