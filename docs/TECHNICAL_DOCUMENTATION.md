# HoneSight 技术文档

> 文档版本：2026-08-25  
> 代码仓库：[yueyao926/lenscoach](https://github.com/yueyao926/lenscoach)  
> 演示环境：[http://101.43.72.205](http://101.43.72.205)

## 1. 项目概述

HoneSight 是面向摄影学习者的全栈 Web 应用。它以“上传作品—AI 分析—针对性追问—持续展示与交流”为主线，提供作品集管理、摄影偏好、每日灵感、摄影社区、私信和搜索等能力。

## 2. 技术选型

| 层级 | 组件 | 职责 |
| --- | --- | --- |
| 前端 | React 18、TypeScript、Vite 6 | 单页应用、路由和页面交互 |
| 样式 | Tailwind CSS、PostCSS | 响应式视觉样式 |
| 后端 | FastAPI、Uvicorn | REST API、鉴权、业务编排 |
| 数据访问 | SQLAlchemy 2、Alembic | ORM 与 PostgreSQL 结构迁移 |
| 数据库 | PostgreSQL 16（生产 Compose 默认） | 用户、作品、分析、社区及搜索数据 |
| 认证 | python-jose、Passlib/bcrypt | JWT 签发与密码哈希 |
| AI | 火山方舟 Ark Responses API | 视觉分析、摄影问答、图片生成/编辑 |
| 内容来源 | Unsplash、Openverse | 每日摄影灵感候选池 |
| 部署 | Docker、Docker Compose、Nginx | 容器编排、静态托管和反向代理 |

## 3. 总体架构

```text
浏览器
  │  HTTP
  ▼
Nginx（frontend 容器，80）
  ├─ /、前端路由 → React 静态资源 / SPA 回退
  ├─ /api/*       → FastAPI（backend:8000，移除 /api 前缀）
  ├─ /uploads/*   → FastAPI 静态文件
  └─ /health、/docs、/openapi.json → FastAPI
                                      │
                                      ├─ PostgreSQL：业务持久化
                                      ├─ Docker volume：上传图片
                                      ├─ 火山方舟：视觉、对话、图片生成
                                      └─ Unsplash / Openverse：灵感内容同步
```

生产编排入口为 `docker-compose.server.yml`：后端和前端分别构建，数据库由 `DATABASE_URL` 指向现有 PostgreSQL；上传目录通过名为 `uploads` 的 Docker volume 持久化。若采用 `docker-compose.prod.yml`，则会额外启动 PostgreSQL 容器和 `pgdata` volume。

## 4. 前端设计

### 4.1 路由与访问控制

前端入口为 `frontend/src/App.tsx`。`ProtectedRoute` 用于保护需登录的页面；令牌失效时 API 客户端会清除本地 `lenscoach_token`、`lenscoach_user` 并跳转 `/login`。

| 路由 | 页面/用途 | 登录要求 |
| --- | --- | --- |
| `/` | 首页、产品介绍、每日灵感 | 否 |
| `/register`、`/login` | 注册和登录 | 否 |
| `/dashboard`、`/onboarding`、`/settings` | 成长概览、偏好建档、设置 | 是 |
| `/profile`、`/users/:userId` | 个人资料、公开主页、关注关系 | 前者是；后者否 |
| `/portfolio`、`/portfolio/:id` | 作品集、作品详情和分析 | 是 |
| `/ai` | AI 图像处理工作台 | 是 |
| `/community`、`/community/post/:id` | 社区信息流和帖子详情 | 否 |
| `/community/post/create`、`/community/post/:id/edit` | 发布和编辑帖子 | 是 |
| `/community/notifications`、`/community/messages/*` | 通知和私信 | 是 |
| `/community/search` | 用户、帖子、图片和标签搜索 | 否 |

### 4.2 API 访问约定

`frontend/src/api/client.ts` 将 `VITE_API_BASE_URL` 作为 API 基址；未设置时使用 `/api`。生产环境经 Nginx 转发，因此构建参数应保持为空或 `/api`。请求体默认 JSON，`FormData` 上传例外；登录后请求自动附带 `Authorization: Bearer <JWT>`。

## 5. 后端设计

### 5.1 应用组成

`backend/app/main.py` 创建 FastAPI 应用，配置 CORS、挂载 `/uploads` 静态目录，并在生命周期内启动每日灵感同步协程。所有业务路由均直接挂在根路径（没有全局 `/api` 前缀）；生产 Nginx 负责兼容前端的 `/api` 前缀。

核心模块：

| 模块 | 说明 |
| --- | --- |
| `api/auth.py` | 注册、登录和当前用户查询 |
| `api/preferences.py`、`api/profile.py` | 摄影偏好、资料、隐私、关注和作品收藏 |
| `api/portfolio.py`、`api/upload.py` | 作品集、照片、照片分析历史、单图对话和文件上传 |
| `api/analyze.py`、`services/analyzer.py` | 预览分析及已保存作品的分析编排 |
| `api/image_process.py`、`services/image_generator.py` | 基于目标风格的图片生成/编辑 |
| `api/inspiration.py` | 今日灵感、收藏、内容同步和审核 |
| `api/community.py`、`api/messages.py` | 帖子、评论、互动、通知、私信与举报 |
| `api/search.py` | 用户、帖子、图片、标签和搜索历史 |

### 5.2 AI 摄影分析流程

```text
用户上传或选择作品
  → 确定目标风格、发布平台和参考图
  → /analyze/preview 或 /analyze/photo
  → analyzer.py
      ├─ mock 模式：生成完整规则化结果
      └─ API 模式：将本地图片转 Data URL，调用火山方舟视觉模型
  → benchmark.py：曝光、对焦、构图、色彩评分及动态权重
  → style_detector.py：风格结论
  → 平台建议、修图参数、下一步建议
  → 已保存作品写入 analysis_results；预览结果仅返回
```

视觉服务不可用、图片无法读取或 API 未配置时的行为需注意：当 `AI_ANALYSIS_MODE=mock` 时明确使用规则结果；API 模式中视觉调用错误会返回 502。照片追问服务则在 AI 调用不可用时退回内置建议。AI 生成图片由 `/image-process/generate` 调用 Seedream 兼容接口，结果下载并保存到上传目录。

### 5.3 评分模型

每张照片输出曝光、对焦、构图、色彩四项 0–100 分，以及总分和目标风格匹配度。总分采用按照片类型变化的加权计算；例如人像强调构图（0.35），夜景强调曝光（0.35），产品强调对焦（0.30）。评分、权重原因和各维度建议会作为 JSON 保存于 `analysis_results`，便于后续对比分析。

## 6. 数据模型

| 领域 | 主要表 | 说明 |
| --- | --- | --- |
| 账户与偏好 | `users`、`preferences`、`user_privacy_settings`、`user_follows` | 账户、摄影偏好、公开范围和社交关系 |
| 作品与分析 | `portfolio_collections`、`portfolio_items`、`photo_tags`、`analysis_results`、`photo_chat_messages`、`portfolio_favorites` | 原图作品集、AI 结果、单图问答与收藏 |
| 社区 | `community_posts`、`community_post_images`、`tags`、`community_post_tags`、`comments`、`post_likes`、`post_favorites` | 帖子、图片、话题、评论和互动 |
| 消息与治理 | `direct_conversations`、`direct_messages`、`notifications`、`reports`、`user_blocks` | 私信、通知、举报和拉黑 |
| 灵感 | `inspiration_photos`、`daily_inspiration_recommendations`、`inspiration_favorites` | 合规摄影内容池、按日推荐和收藏 |
| 搜索 | `post_search_documents`、`search_histories` | 帖子检索文档和用户历史 |

外键多数使用 `ON DELETE CASCADE`，以保证用户、作品或帖子删除时关联数据同步清理。Alembic 的迁移位于 `backend/alembic/versions`，部署新版本必须先执行 `alembic upgrade head`。

## 7. API 概览

完整可交互契约以运行中的 Swagger 为准：生产环境为 `http://101.43.72.205/docs`，本地为 `http://localhost:8000/docs`。除注册、登录、公开内容和标注“可选登录”的查询外，接口需 Bearer JWT。

| 资源 | 主要端点 |
| --- | --- |
| 健康检查 | `GET /health` |
| 认证 | `POST /auth/register`、`POST /auth/login`、`GET /auth/me` |
| 偏好 | `GET/POST/PUT /preferences/me` |
| 上传 | `POST /upload/image`；`/uploads/*` 为静态访问路径 |
| 作品集 | `GET/POST /portfolio`、`GET/PATCH/DELETE /portfolio/{id}`、`POST /portfolio/{id}/photos`、`GET /portfolio/{id}/analysis`、`GET/POST /portfolio/{id}/chat` |
| AI | `POST /analyze/preview`、`POST /analyze/photo`、`POST /image-process/generate` |
| 资料与社交 | `/me/profile`、`/me/privacy`、`/users/{id}/profile`、`/users/{id}/works`、关注者/关注、作品收藏 |
| 灵感 | `GET /inspirations/today`、详情、收藏；管理员同步、审核接口位于 `/inspirations/admin/*` |
| 社区 | 帖子 CRUD、信息流、点赞、收藏、评论、通知、举报和拉黑均位于 `/community/*` |
| 私信 | 会话、消息、已读、会话设置、拒绝、举报和图片上传位于 `/messages/*` |
| 搜索 | `GET /search` 及 `/search/users|posts|images|tags|suggestions|history` |

## 8. 配置与安全

生产环境从仓库根目录 `.env` 读取变量，可从 `server.env.example` 复制。真实密钥只能放入未提交的环境文件，不能写进前端代码或 Git。

| 变量 | 必填 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串（`docker-compose.server.yml`） |
| `JWT_SECRET_KEY` | 是 | JWT 签名密钥；应使用高熵随机值 |
| `CORS_ORIGINS` | 是 | 允许的前端来源，多个值逗号分隔 |
| `PORT` | 否 | 前端对外端口，默认 80 |
| `AI_*` / `ARK_*` | 视功能而定 | 视觉分析与对话模型配置 |
| `IMAGE_*` | 视功能而定 | 图片生成/编辑模型配置 |
| `UNSPLASH_*`、`OPENVERSE_*` | 否 | 灵感池内容同步凭据 |
| `INSPIRATION_*` | 否 | 灵感数量、审核管理员与定时同步策略 |

当前安全措施包括 bcrypt 密码哈希、JWT 鉴权、CORS 白名单、文件 MIME/扩展名/大小限制、上传文件 UUID 命名、用户资源归属校验、社区可见性和拉黑关系过滤。生产上还应配置 HTTPS、定期备份 PostgreSQL 与 `uploads` volume、限制反向代理请求体大小，并轮换 JWT 和第三方 API 密钥。

## 9. 部署与运维

### 9.1 首次部署

```bash
git clone https://github.com/yueyao926/lenscoach.git
cd lenscoach
cp server.env.example .env
# 编辑 .env，至少设置 DATABASE_URL、JWT_SECRET_KEY、CORS_ORIGINS
docker compose -f docker-compose.server.yml up -d --build
```

如果数据库也由 Docker 管理，使用 `docker-compose.prod.yml` 并设置 `DB_PASSWORD`、`JWT_SECRET_KEY` 等变量。首次或版本升级时执行迁移：

```bash
docker compose -f docker-compose.server.yml exec backend alembic upgrade head
```

### 9.2 验证与常用操作

```bash
docker compose -f docker-compose.server.yml ps
docker compose -f docker-compose.server.yml logs -f --tail=100
curl http://localhost/health
curl http://localhost/openapi.json
```

服务健康检查为后端 `/health`；Nginx 同时代理 `/health`、`/docs` 和 `/openapi.json`。更新代码后重新执行 `up -d --build`，并在后端镜像启动后执行数据库迁移。上传卷不应随容器重建删除。

## 10. 本地开发与质量检查

```bash
# 后端
cd backend
python -m venv .venv
.venv/Scripts/activate  # Windows PowerShell 可用 .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 前端（另一终端）
cd frontend
npm install
npm run dev
```

前端地址为 `http://localhost:5173`，后端 Swagger 为 `http://localhost:8000/docs`。后端现有测试位于 `backend/tests`，覆盖图片来源、消息搜索和灵感内容等关键服务；提交前至少执行前端构建和对应的 pytest 测试集。

## 11. 已知边界与后续建议

- 上传文件目前存放在本地/Docker volume，尚未接入对象存储或 CDN；多实例部署前应迁移到 OSS/S3 等共享存储。
- AI 能力依赖第三方模型与网络。应保留 mock 模式用于开发和演示，并为生产调用增加监控、重试与成本控制。
- 搜索当前返回 `hybrid_lexical`，`semantic_available` 为 `false`；语义检索相关配置已预留但尚未启用。
- 生产站点应补齐备份恢复演练和错误告警策略。
