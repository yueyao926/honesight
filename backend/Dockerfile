FROM python:3.12-slim

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY requirements.txt .
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_FALLBACK_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install \
      --no-cache-dir \
      --retries 5 \
      --timeout 60 \
      --index-url "$PIP_INDEX_URL" \
      -r requirements.txt \
    || pip install \
      --no-cache-dir \
      --retries 5 \
      --timeout 60 \
      --index-url "$PIP_FALLBACK_INDEX_URL" \
      -r requirements.txt

# 复制应用代码
COPY . .

# 确保上传目录存在
RUN mkdir -p uploads

EXPOSE 8000

# 启动时先执行数据库迁移，再启动服务
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
