# 環境變數配置說明

## 創建 .env 文件

在項目根目錄創建 `.env` 文件，並添加以下配置：

```bash
# Database Configuration
POSTGRES_DB=research_papers
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# Backend Configuration
DATABASE_URL=postgresql://admin:password123@postgres:5432/research_papers
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_N8N_CHAT_URL=
```

## 使用方法

### 1. 創建 .env 文件
```bash
# 在項目根目錄執行
touch .env
```

### 2. 複製配置
將上面的配置內容複製到 `.env` 文件中

### 3. 自定義配置
根據需要修改以下變數：
- `POSTGRES_PASSWORD`: 數據庫密碼
- `MINIO_ROOT_PASSWORD`: MinIO 密碼
- `NEXT_PUBLIC_N8N_CHAT_URL`: n8n 聊天 webhook URL

### 4. 啟動服務
```bash
docker-compose up -d
```

## 安全注意事項

- `.env` 文件已加入 `.gitignore`，不會被提交到版本控制
- 生產環境請使用強密碼
- 定期更換敏感信息

## 環境變數說明

| 變數名 | 說明 | 默認值 |
|--------|------|--------|
| `POSTGRES_DB` | 數據庫名稱 | `research_papers` |
| `POSTGRES_USER` | 數據庫用戶名 | `admin` |
| `POSTGRES_PASSWORD` | 數據庫密碼 | `password123` |
| `MINIO_ROOT_USER` | MinIO 用戶名 | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO 密碼 | `minioadmin123` |
| `DATABASE_URL` | 數據庫連接字符串 | `postgresql://admin:password123@postgres:5432/research_papers` |
| `MINIO_ENDPOINT` | MinIO 端點 | `minio:9000` |
| `MINIO_ACCESS_KEY` | MinIO 訪問密鑰 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 秘密密鑰 | `minioadmin123` |
| `NEXT_PUBLIC_API_URL` | 前端 API URL | `http://localhost:8000` |
| `NEXT_PUBLIC_N8N_CHAT_URL` | n8n 聊天 webhook URL | `https://n8n.yourdomain.com/webhook/...` |
