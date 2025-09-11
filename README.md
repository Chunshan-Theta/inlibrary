# 研究室論文管理系統

基於 Next.js + FastMCP + PostgreSQL + MinIO 構建的現代化論文管理系統，支持多條件搜索和文件管理。

## 🌟 功能特色

- **多條件搜索**: 支持論文標題、作者姓名、年份範圍、引用數、摘要關鍵字等多維度搜索
- **文件管理**: 基於 MinIO 的 PDF 文件存儲和下載
- **標籤系統**: 靈活的論文分類和標記
- **作者管理**: 完整的作者信息和關聯管理
- **期刊會議**: 支持期刊和會議信息管理
- **現代化界面**: 響應式設計，美觀易用

## 🏗️ 系統架構

```
Frontend (Next.js)  ←→  Backend (FastMCP)  ←→  Database (PostgreSQL)
                              ↕
                         File Storage (MinIO)
```

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **後端**: FastAPI + FastMCP + SQLAlchemy
- **數據庫**: PostgreSQL 15 (支持全文搜索)
- **文件存儲**: MinIO (S3兼容)
- **容器化**: Docker + Docker Compose

## 🚀 快速開始

### 環境要求

- Docker 20.10+
- Docker Compose 2.0+

### 一鍵部署

1. **克隆項目**
```bash
git clone <repository-url>
cd inlibrary
```

2. **啟動服務**
```bash
# 啟動所有服務
docker-compose up -d

# 查看服務狀態
docker-compose ps
```

3. **訪問應用**
- 前端界面: http://localhost:3000
- 後端API: http://localhost:8000
- MinIO控制台: http://localhost:9001 (用戶名: minioadmin, 密碼: minioadmin123)
- API文檔: http://localhost:8000/docs

### 開發模式

如果需要進行開發，可以分別啟動各服務：

1. **啟動基礎服務**
```bash
# 只啟動數據庫和MinIO
docker-compose up -d postgres minio
```

2. **啟動後端服務**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. **啟動前端服務**
```bash
cd frontend
npm install
npm run dev
```

## 📊 數據庫結構

系統包含以下主要數據表：

- `papers`: 論文主表
- `authors`: 作者表
- `venues`: 期刊/會議表
- `tags`: 標籤表
- `paper_authors`: 論文作者關聯表
- `paper_tags`: 論文標籤關聯表
- `citations`: 論文引用關係表

詳細的數據庫結構請參考 `database/init.sql`。

## 🔍 搜索功能

系統支持以下搜索條件：

- **標題關鍵字**: 使用 PostgreSQL 全文搜索
- **作者姓名**: 支持作者姓名模糊匹配
- **發表年份**: 年份範圍搜索
- **引用數**: 引用數範圍篩選
- **摘要關鍵字**: 摘要內容全文搜索
- **期刊/會議**: 按發表渠道篩選
- **標籤**: 多標籤組合搜索

## 🎯 使用指南

### 添加論文

1. 點擊主頁面的"添加論文"按鈕
2. 填寫論文基本信息（標題、年份等）
3. 選擇作者和標籤
4. 可選擇上傳PDF文件
5. 點擊"添加論文"完成

### 搜索論文

1. 在搜索表單中輸入搜索條件
2. 可以組合使用多個搜索條件
3. 點擊"搜索"按鈕查看結果
4. 點擊"重置"清空搜索條件

### 文件管理

- 上傳: 在添加論文時可直接上傳PDF
- 下載: 在論文列表中點擊"下載PDF"按鈕
- 存儲: 文件自動存儲在MinIO中，按論文ID組織

## 🔧 配置說明

### 環境變量

可以通過修改 `docker-compose.yml` 中的環境變量來配置系統：

```yaml
# 數據庫配置
POSTGRES_DB: research_papers
POSTGRES_USER: admin
POSTGRES_PASSWORD: password123

# MinIO配置
MINIO_ROOT_USER: minioadmin
MINIO_ROOT_PASSWORD: minioadmin123

# API配置
NEXT_PUBLIC_API_URL: http://localhost:8000
```

### 端口配置

默認端口映射：
- 前端: 3000
- 後端API: 8000
- PostgreSQL: 5432
- MinIO API: 9000
- MinIO Console: 9001

## 📝 API文檔

系統提供完整的RESTful API，包括：

### 論文相關
- `GET /papers/`: 獲取論文列表
- `POST /papers/`: 創建新論文
- `GET /papers/{id}`: 獲取單個論文
- `PUT /papers/{id}`: 更新論文
- `DELETE /papers/{id}`: 刪除論文
- `GET /papers/search/`: 搜索論文

### 文件相關
- `POST /papers/{id}/upload-pdf/`: 上傳PDF
- `GET /papers/{id}/download-pdf/`: 下載PDF

### 其他資源
- 作者管理: `/authors/`
- 標籤管理: `/tags/`
- 期刊會議: `/venues/`

詳細API文檔可訪問: http://localhost:8000/docs

## 🛠️ 開發指南

### 技術棧

**前端**:
- Next.js 14 (React 18)
- TypeScript
- Tailwind CSS
- React Query (數據獲取)
- React Hook Form (表單處理)
- Heroicons (圖標)

**後端**:
- FastAPI (Python Web框架)
- FastMCP (MCP服務器框架)
- SQLAlchemy (ORM)
- Pydantic (數據驗證)
- psycopg2 (PostgreSQL驅動)
- MinIO Python SDK

### 項目結構

```
inlibrary/
├── docker-compose.yml          # Docker編排配置
├── database/
│   └── init.sql               # 數據庫初始化腳本
├── backend/                   # 後端代碼
│   ├── main.py               # FastAPI主應用
│   ├── models.py             # SQLAlchemy模型
│   ├── schemas.py            # Pydantic schemas
│   ├── crud.py               # CRUD操作
│   ├── database.py           # 數據庫連接
│   ├── minio_client.py       # MinIO客戶端
│   └── requirements.txt      # Python依賴
└── frontend/                  # 前端代碼
    ├── src/
    │   ├── pages/            # Next.js頁面
    │   ├── components/       # React組件
    │   ├── api/             # API調用
    │   ├── types/           # TypeScript類型
    │   └── styles/          # 樣式文件
    ├── package.json         # Node.js依賴
    └── next.config.js       # Next.js配置
```

## 🔄 更新部署

```bash
# 停止現有服務
docker-compose down

# 拉取最新代碼
git pull

# 重新構建並啟動
docker-compose up --build -d
```

## 🗃️ 數據備份

### PostgreSQL備份
```bash
# 備份數據庫
docker exec research_postgres pg_dump -U admin research_papers > backup.sql

# 恢復數據庫
docker exec -i research_postgres psql -U admin research_papers < backup.sql
```

### MinIO數據備份
```bash
# 使用MinIO客戶端工具備份
mc cp --recursive local/research-papers/ backup/
```

## 🐛 故障排除

### 常見問題

1. **容器啟動失敗**
   - 檢查端口是否被占用
   - 確認Docker版本兼容性

2. **數據庫連接失敗**
   - 檢查PostgreSQL容器狀態
   - 驗證數據庫連接參數

3. **文件上傳失敗**
   - 檢查MinIO服務狀態
   - 確認存儲空間充足

4. **前端無法訪問API**
   - 檢查CORS配置
   - 驗證API URL設置

### 日志查看

```bash
# 查看所有服務日志
docker-compose logs -f

# 查看特定服務日志
docker-compose logs -f frontend
docker-compose logs -f fastmcp_server
```

## 📄 許可證

本項目使用 MIT 許可證。

## 🤝 貢獻

歡迎提交Issue和Pull Request來改進這個項目。

## 📞 聯繫

如有問題或建議，請通過以下方式聯繫：
- 提交GitHub Issue
- 發送郵件到 [your-email@example.com]

---

**注意**: 這是一個演示項目，生產環境使用時請確保：
- 修改默認密碼
- 配置HTTPS
- 設置適當的備份策略
- 實施訪問控制 