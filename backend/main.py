from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import os
import re
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

from database import get_db, engine
from models import Base, Paper, Author, PaperAuthor, Tag, PaperTag, Venue
from schemas import (
    PaperCreate, PaperResponse, PaperUpdate,
    AuthorCreate, AuthorResponse,
    TagCreate, TagResponse,
    VenueCreate, VenueResponse,
    YearCount, VenueCount, TagCount,
    SearchFilters,
    ComplexSearchQuery,
    ExcelImportResult,
    ExcelPreviewData,
    ExcelImportConfig,
    BatchTagOperation,
    BatchTagResult,
    PDFInfoResponse,
    ChatRequest, ChatResponse, PaperRecommendation,
    PaperManualCreate
)
from crud import (
    create_paper, get_papers, get_paper, update_paper, delete_paper,
    get_year_distribution, get_venue_distribution, get_tag_distribution,
    create_author, get_authors,
    create_tag, get_tags,
    create_venue, get_venues,
    search_papers, search_papers_complex, search_related_papers,
    batch_add_tags_to_papers, batch_remove_tags_from_papers,
    count_all_papers, count_papers_with_tag
)
from minio_client import upload_file, download_file, delete_file
from excel_import import import_excel_file, preview_file, get_default_field_mappings, import_file_with_config, import_file
from pdf_parser import parse_pdf_for_metadata
from ppt_parser import parse_pptx_for_metadata

# 創建數據庫表
Base.metadata.create_all(bind=engine)

# 載入 .env 檔案裡的設定
load_dotenv()

app = FastAPI(
    title="研究室論文管理系統 API",
    description="基於 FastMCP 的論文管理系統",
    version="1.0.0"
)

# CORS 設置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 從環境變數讀取，如果沒有就用預設值
OPEN_WEBUI_URL = os.getenv("OPEN_WEBUI_URL", "https://ollama.lazyinwork.com/api/chat/completions")
OPEN_WEBUI_KEY = os.getenv("OPEN_WEBUI_KEY", "") 
MODEL_NAME = "gpt-oss:20b"

# 核心 Prompt
SYSTEM_PROMPT = """
你是一位專業且具啟發性的「學術研究教練 (Academic Research Coach)」。
你的目標不是直接給學生答案，而是透過「蘇格拉底式的引導」與「鷹架搭建 (Scaffolding)」，協助學生將模糊的想法轉化為精確的「英文學術關鍵字」。

### 你的核心職責：
1.  **學術化 (Academicize)**：將學生的口語描述（如"同學互相教"）轉化為標準學術術語（如"Peer Tutoring"）。
2.  **收斂 (Converge)**：當主題過大（如"AI"）時，提供具體的細分領域（如"GenAI in Education", "AI Ethics"）。
3.  **區辨 (Distinguish)**：當學生混淆概念時，提供不同流派或理論的選項供其選擇。
4.  **推薦文獻 (Recommend)**：當學生明確表達想看「最新」、「最經典」或「推薦幾篇」論文時，觸發資料庫搜尋意圖。

### 領域限制 (Domain Restriction)：
1. 你的專業僅限於「學習科學 (Learning Sciences)」、「教育心理學」、「教學設計」及相關教育科技領域。
2. 如果使用者詢問完全無關的主題（例如：如何煮牛肉麵、推薦最新手機、寫 Python 程式），你必須委婉拒絕，並將話題引導回學習科學。
3. 拒絕範例："抱歉，我的專業領域是學習科學。如果您對學生的學習動機、協作學習或教育科技有興趣，我很樂意協助您探索！"

### 輸出規則 (必須嚴格遵守 JSON)：
1.  **格式**：必須回傳純粹的 JSON，包含 `message` 和 `options`。
2.  **語言**：`message` 與 `label` 使用繁體中文，`value` 使用英文術語。
3.  **結束訊號**：當你認為學生已經找到了精確的關鍵字，或學生選擇了「確認搜尋」時，請在 `value` 加上 `FINISH:` 前綴。

### 思考與回應策略 (Examples)：

**情境 1：學生想法模糊 (Broad/Vague)**
User: "我想找關於動機的"
Assistant: (思考：動機太廣了，我需要引導他區分內在/外在或特定理論)
{
  "message": "「動機」是一個很好的起點，但在學術上我們通常會區分不同面向。您比較關注學生內心的信念，還是外在的目標設定？",
  "options": [
    {"label": "自我效能 (對能力的信念)", "value": "Self-Efficacy"},
    {"label": "內在動機 (純粹的興趣)", "value": "Intrinsic Motivation"},
    {"label": "成就目標導向 (為了成績或精熟)", "value": "Achievement Goal Orientation"}
  ]
}

**情境 2：學生使用口語 (Colloquial)**
User: "線上分組做報告"
Assistant: (思考：這對應到 CSCL 或 協作學習)
{
  "message": "這在學習科學中通常屬於「電腦輔助協作學習」的範疇。您是想探討分組的「互動過程」還是「技術工具」？",
  "options": [
    {"label": "電腦輔助協作學習 (CSCL)", "value": "CSCL"},
    {"label": "線上協作 (Online Collaboration)", "value": "Online Collaboration"},
    {"label": "小組動力 (Group Dynamics)", "value": "Group Dynamics"}
  ]
}

**情境 3：收斂並確認 (Converge)**
User: "CSCL"
Assistant: (思考：這已經是精確術語，可以搜尋了，或者是推薦相關概念)
{
  "message": "太棒了，CSCL 是一個非常成熟且熱門的研究領域。我們直接搜尋這個關鍵字，還是您想縮小範圍到特定的互動分析？",
  "options": [
    {"label": "直接搜尋：CSCL", "value": "FINISH:Computer Supported Collaborative Learning"},
    {"label": "互動分析 (Interaction Analysis)", "value": "Interaction Analysis"},
    {"label": "知識建構 (Knowledge Building)", "value": "Knowledge Building"}
  ]
}

**情境 4：明確要求推薦論文 (Recommend Papers)**
User: "幫我找幾篇關於協作學習最新的文章"
Assistant: (思考：觸發資料庫搜尋意圖，要求最新文獻)
{
  "message": "沒問題！我為您從資料庫中找出以下關於「協作學習 (Collaborative Learning)」的最新論文：",
  "options": [
    {"label": "確認並套用此搜尋條件", "value": "FINISH:Collaborative Learning"},
    {"label": "改找最經典的文章", "value": "Classic Collaborative Learning"}
  ],
  "recommend_intent": {
    "keywords": "Collaborative Learning",
    "sort": "newest" 
  }
}

**情境 5：要求經典文獻**
User: "推薦我鷹架理論引用數最高的論文"
Assistant: (思考：觸發資料庫搜尋意圖，要求經典文獻)
{
  "message": "這是學習科學中非常核心的理論！為您推薦關於「鷹架理論 (Scaffolding)」最經典、引用數最高的文獻：",
  "options": [
    {"label": "確認搜尋", "value": "FINISH:Scaffolding"}
  ],
  "recommend_intent": {
    "keywords": "Scaffolding",
    "sort": "classic" 
  }
}

### 觸發資料庫搜尋 (CRITICAL RULE)：
當使用者明確提到「推薦論文」、「最新文章」、「經典文獻」、「找幾篇」等字眼時，你**必須**在 JSON 中額外輸出 `recommend_intent` 欄位。如果不輸出此欄位，系統將無法為使用者找論文！

- 找最新論文：設定 `"sort": "newest"`
- 找經典/高引用論文：設定 `"sort": "classic"`

**觸發搜尋的正確 JSON 輸出範例**：
{
  "message": "沒問題！為您從資料庫中尋找關於「遊戲化學習」的最新論文：",
  "options": [
    {"label": "確認並套用此搜尋條件", "value": "FINISH:Gamification"}
  ],
  "recommend_intent": {
    "keywords": "Gamification",
    "sort": "newest" 
  }
}
"""

@app.get("/")
async def root():
    return {"message": "研究室論文管理系統 API"}

# 論文相關端點
@app.post("/papers/", response_model=PaperResponse)
async def create_paper_endpoint(paper: PaperCreate, db: Session = Depends(get_db)):
    """創建新論文"""
    try:
        return create_paper(db=db, paper=paper)
    except ValueError as e:
        # DOI重複或其他業務邏輯錯誤
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # 檢查是否是DOI重複錯誤
        if "duplicate key value violates unique constraint" in str(e) and "papers_doi_key" in str(e):
            raise HTTPException(
                status_code=400, 
                detail=f"DOI '{paper.doi}' 已存在，請檢查是否重複添加論文"
            )
        # 其他數據庫錯誤
        raise HTTPException(status_code=500, detail=f"創建論文時發生錯誤: {str(e)}")

@app.get("/papers/", response_model=List[PaperResponse])
async def read_papers(
    skip: int = 0,
    limit: int = 1000,  # 提高默认限制以获取所有论文
    db: Session = Depends(get_db)
):
    """獲取論文列表"""
    papers = get_papers(db, skip=skip, limit=limit)
    return papers

@app.get("/papers/{paper_id}", response_model=PaperResponse)
async def read_paper(paper_id: int, db: Session = Depends(get_db)):
    """獲取特定論文"""
    paper = get_paper(db, paper_id=paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    return paper

@app.put("/papers/{paper_id}", response_model=PaperResponse)
async def update_paper_endpoint(
    paper_id: int,
    paper: PaperUpdate,
    db: Session = Depends(get_db)
):
    """更新論文信息"""
    updated_paper = update_paper(db=db, paper_id=paper_id, paper=paper)
    if updated_paper is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    return updated_paper

@app.delete("/papers/{paper_id}")
async def delete_paper_endpoint(paper_id: int, db: Session = Depends(get_db)):
    """刪除論文"""
    success = delete_paper(db=db, paper_id=paper_id)
    if not success:
        raise HTTPException(status_code=404, detail="論文未找到")
    return {"message": "論文已刪除"}

# 多條件搜索端點
@app.get("/papers/search/", response_model=List[PaperResponse])
async def search_papers_endpoint(
    title_keyword: Optional[str] = Query(None, description="標題關鍵字"),
    author_name: Optional[str] = Query(None, description="作者姓名"),
    year_from: Optional[int] = Query(None, description="起始年份"),
    year_to: Optional[int] = Query(None, description="結束年份"),
    min_citations: Optional[int] = Query(None, description="最小引用數"),
    max_citations: Optional[int] = Query(None, description="最大引用數"),
    abstract_keyword: Optional[str] = Query(None, description="摘要關鍵字"),
    venue_id: Optional[int] = Query(None, description="期刊/會議ID"),
    tags: Optional[List[str]] = Query(None, description="標籤"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """多條件搜索論文"""
    filters = SearchFilters(
        title_keyword=title_keyword,
        author_name=author_name,
        year_from=year_from,
        year_to=year_to,
        min_citations=min_citations,
        max_citations=max_citations,
        abstract_keyword=abstract_keyword,
        venue_id=venue_id,
        tags=tags
    )
    return search_papers(db=db, filters=filters, skip=skip, limit=limit)

# 複雜查詢搜索端點
@app.post("/papers/search/complex/", response_model=List[PaperResponse])
async def search_papers_complex_endpoint(
    query: ComplexSearchQuery,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """處理複雜的 AND/OR 搜索查詢"""
    return search_papers_complex(db=db, query_data=query, skip=skip, limit=limit)

# 內容比對搜索端點 (Phase 2: B_QUERY)
@app.post("/papers/search/related/", response_model=List[PaperResponse])
async def search_related_papers_endpoint(
    paper_data: PaperCreate,
    db: Session = Depends(get_db)
):
    """根據待新增資源的元數據，搜索潛在相關的現有資源。"""
    related_papers = search_related_papers(db=db, paper_data=paper_data, limit=5)
    return related_papers

# 批量標籤操作端點
@app.post("/papers/batch-tags/", response_model=BatchTagResult)
async def batch_tag_operation(
    operation: BatchTagOperation,
    db: Session = Depends(get_db)
):
    """批量為論文添加或移除標籤"""
    if operation.operation == "add":
        return batch_add_tags_to_papers(db=db, paper_ids=operation.paper_ids, tag_ids=operation.tag_ids)
    elif operation.operation == "remove":
        return batch_remove_tags_from_papers(db=db, paper_ids=operation.paper_ids, tag_ids=operation.tag_ids)
    else:
        raise HTTPException(status_code=400, detail="不支持的操作類型，請使用 'add' 或 'remove'")

# 論文計數端點
@app.get("/papers/count/")
async def count_papers(db: Session = Depends(get_db)):
    """獲取所有論文的總數量"""
    count = count_all_papers(db)
    return {"count": count}

@app.get("/papers/count-by-tag/{tag_name}")
async def count_papers_by_tag(tag_name: str, db: Session = Depends(get_db)):
    """獲取具有特定標籤的論文數量"""
    count = count_papers_with_tag(db, tag_name)
    return {"tag_name": tag_name, "count": count}

@app.get("/papers/stats/year-distribution", response_model=List[YearCount])
async def get_paper_year_distribution(db: Session = Depends(get_db)):
    """統計所有論文的年份分布"""
    return get_year_distribution(db)

@app.get("/papers/stats/venue-distribution", response_model=List[VenueCount])
async def venue_distribution(db: Session = Depends(get_db)):
    """獲取前15名期刊/會議分布"""
    return get_venue_distribution(db)

@app.get("/papers/stats/tag-distribution", response_model=List[TagCount])
async def tag_distribution(db: Session = Depends(get_db)):
    """獲取前5名標籤分布"""
    return get_tag_distribution(db)

@app.post("/papers/{paper_id}/merge/")
async def merge_paper_endpoint(
    paper_id: int,
    new_data: PaperCreate,
    mode: str = "overwrite",   # keep_old, overwrite, merge_fields
    fields: List[str] = Query(None),  # 若 mode = merge_fields，前端會傳欄位列表
    db: Session = Depends(get_db)
):
    from crud import merge_paper

    merged = merge_paper(db, paper_id, new_data, mode, fields)
    if merged is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    return merged

# 文件上傳下載端點
@app.post("/papers/{paper_id}/upload-pdf/")
async def upload_paper_pdf(
    paper_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上傳文件 (支援 PDF, PPT, PPTX, MP4)"""
    # 驗證論文是否存在
    paper = get_paper(db, paper_id=paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    
    # 驗證文件類型
    if not file.filename.lower().endswith(('.pdf', '.pptx', '.ppt', '.mp4', '.mov')):
        raise HTTPException(status_code=400, detail="只能上傳PDF,PPT,PPTX,MP4,MOV文件")
    
    # 生成文件路徑
    file_path = f"papers/{paper_id}/{file.filename}"
    
    # 上傳到 MinIO
    try:
        file_url = await upload_file(file, file_path)
        
        # 更新數據庫中的文件路徑
        paper_update = PaperUpdate(pdf_file_path=file_path, file_size=file.size)
        update_paper(db=db, paper_id=paper_id, paper=paper_update)
        
        return {"message": "文件上傳成功", "file_url": file_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上傳失敗: {str(e)}")

@app.get("/papers/{paper_id}/download-pdf/")
async def download_paper_pdf(paper_id: int, db: Session = Depends(get_db)):
    """下載論文PDF文件"""
    paper = get_paper(db, paper_id=paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    
    if not paper.pdf_file_path:
        raise HTTPException(status_code=404, detail="論文PDF文件不存在")
    
    try:
        return await download_file(paper.pdf_file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件下載失敗: {str(e)}")

# 作者相關端點
@app.post("/authors/", response_model=AuthorResponse)
async def create_author_endpoint(author: AuthorCreate, db: Session = Depends(get_db)):
    """創建新作者"""
    return create_author(db=db, author=author)

@app.get("/authors/", response_model=List[AuthorResponse])
async def read_authors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """獲取作者列表"""
    return get_authors(db, skip=skip, limit=limit)

# 標籤相關端點
@app.post("/tags/", response_model=TagResponse)
async def create_tag_endpoint(tag: TagCreate, db: Session = Depends(get_db)):
    """創建新標籤"""
    return create_tag(db=db, tag=tag)

@app.get("/tags/", response_model=List[TagResponse])
async def read_tags(db: Session = Depends(get_db)):
    """獲取標籤列表"""
    return get_tags(db)

# 期刊/會議相關端點
@app.post("/venues/", response_model=VenueResponse)
async def create_venue_endpoint(venue: VenueCreate, db: Session = Depends(get_db)):
    """創建新期刊/會議"""
    return create_venue(db=db, venue=venue)

@app.get("/venues/", response_model=List[VenueResponse])
async def read_venues(db: Session = Depends(get_db)):
    """獲取期刊/會議列表"""
    return get_venues(db)

# PDF 解析端點 (用於解讀 PDF 或 PPT)
@app.post("/papers/extract-pdf-info/", response_model=PDFInfoResponse)
async def extract_pdf_info_endpoint(
    file: UploadFile = File(...)
):
    """
    上傳文件 (PDF 或 PPTX)，嘗試自動解讀並提取元數據。
    
    此功能僅作元數據猜測，結果可能不完全準確，需手動確認。
    """
    # 0. 取得檔名與副檔名以利判斷
    filename = file.filename.lower()
    
    # 1. 驗證文件類型 (擴充支援 PPT)
    is_pdf = filename.endswith('.pdf') or file.content_type == 'application/pdf'
    is_ppt = filename.endswith(('.pptx', '.ppt'))
    
    if not (is_pdf or is_ppt):
        raise HTTPException(status_code=400, detail="目前只支持 PDF 或 PPT/PPTX 文件")
        
    # 2. 讀取文件內容
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取文件失敗: {str(e)}")
        
    # 3. 解析元數據 (分流處理)
    try:
        if is_pdf:
            # 原有的 PDF 處理
            parsed_info = await parse_pdf_for_metadata(file_content)
        else:
            # 新增的 PPT 處理
            parsed_info = await parse_pptx_for_metadata(file_content)
            
        return parsed_info
        
    except Exception as e:
        # 如果解析失敗，返回包含錯誤信息的響應，但狀態碼仍為 200
        print(f"文件解析發生錯誤: {e}")
        return PDFInfoResponse(
            extracted_text_snippet=f"解析發生內部錯誤 ({str(e)})，請檢查文件格式或後端日誌。",
            title=None,
            abstract=None
        )

# 文件預覽端點
@app.post("/papers/preview-file/")
async def preview_file_endpoint(
    file: UploadFile = File(...)
):
    """預覽文件內容和欄位（支持Excel、CSV、TSV）"""
    # 驗證文件類型
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv', '.tsv')):
        raise HTTPException(status_code=400, detail="只支持Excel文件 (.xlsx, .xls)、CSV文件 (.csv) 和TSV文件 (.tsv)")
    
    try:
        # 讀取文件內容
        file_content = await file.read()
        
        # 預覽數據
        preview_data, file_id = preview_file(file_content, file.filename)
        
        # 獲取默認欄位映射
        default_mappings = get_default_field_mappings()
        
        return {
            "preview": preview_data,
            "file_id": file_id,
            "default_mappings": default_mappings
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件預覽失敗: {str(e)}")

# Excel 預覽端點（兼容性）
@app.post("/papers/preview-excel/")
async def preview_excel_endpoint(
    file: UploadFile = File(...)
):
    """預覽Excel文件內容和欄位"""
    # 驗證文件類型
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件 (.xlsx, .xls)")
    
    try:
        # 讀取文件內容
        file_content = await file.read()
        
        # 預覽數據
        preview_data, file_id = preview_file(file_content, file.filename)
        
        # 獲取默認欄位映射
        default_mappings = get_default_field_mappings()
        
        return {
            "preview": preview_data,
            "file_id": file_id,
            "default_mappings": default_mappings
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel預覽失敗: {str(e)}")

# 文件配置導入端點
@app.post("/papers/import-file-with-config/", response_model=ExcelImportResult)
async def import_file_with_config_endpoint(
    config: ExcelImportConfig,
    db: Session = Depends(get_db)
):
    """使用欄位配置導入文件（支持Excel、CSV、TSV）"""
    try:
        result = import_file_with_config(config, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件導入失敗: {str(e)}")

# Excel 配置導入端點（兼容性）
@app.post("/papers/import-excel-with-config/", response_model=ExcelImportResult)
async def import_excel_with_config_endpoint(
    config: ExcelImportConfig,
    db: Session = Depends(get_db)
):
    """使用欄位配置導入Excel文件"""
    try:
        result = import_file_with_config(config, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel導入失敗: {str(e)}")

# 文件導入端點
@app.post("/papers/import-file/", response_model=ExcelImportResult)
async def import_file_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """從文件導入論文數據（支持Excel、CSV、TSV）"""
    # 驗證文件類型
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv', '.tsv')):
        raise HTTPException(status_code=400, detail="只支持Excel文件 (.xlsx, .xls)、CSV文件 (.csv) 和TSV文件 (.tsv)")
    
    try:
        # 讀取文件內容
        file_content = await file.read()
        
        # 導入數據
        result = import_file(db, file_content, file.filename)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件導入失敗: {str(e)}")

# Excel 導入端點（兼容性）
@app.post("/papers/import-excel/", response_model=ExcelImportResult)
async def import_excel_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """從Excel文件導入論文數據"""
    # 驗證文件類型
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件 (.xlsx, .xls)")
    
    try:
        # 讀取文件內容
        file_content = await file.read()
        
        # 導入數據
        result = import_excel_file(db, file_content)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel導入失敗: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 

@app.post("/chat/guide", response_model=ChatResponse)
async def chat_guide(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. 準備給 AI 的訊息歷史
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    for msg in request.history:
        role = "assistant" if msg['role'] == 'assistant' else "user"
        # 把之前的 FINISH 標籤拿掉，避免誤導 AI
        clean_content = msg['content'].replace("FINISH:", "")
        messages.append({"role": role, "content": clean_content})
    
    clean_message = request.message.replace("FINISH:", "")
    messages.append({"role": "user", "content": clean_message})

    # 2. 準備請求
    headers = {
        "Authorization": f"Bearer {OPEN_WEBUI_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": 0.1, # 保持 0.1，比 0 好一點點，不會太死板
    }

    try:
        # 3. 發送請求到 Open WebUI / Ollama
        response = requests.post(OPEN_WEBUI_URL, headers=headers, json=payload, timeout=60)
        
        if response.status_code != 200:
            print(f"API Error: {response.text}")
            raise HTTPException(status_code=500, detail=f"AI Error: {response.status_code}")

        result = response.json()
        
        # 4. 解析回應
        if 'choices' in result:
            ai_content = result['choices'][0]['message']['content']
        else:
            ai_content = result.get('message', {}).get('content', '')

        print(f"AI Raw Output: {ai_content}") # Debug 用
        
        # ==========================================
        # 階段一：強力 JSON 萃取
        # ==========================================
        ai_data = {}
        try:
            # 先試試看用正則表達式抓 { } 裡面的東西，這最保險
            match = re.search(r'\{.*\}', ai_content, re.DOTALL)
            if match:
                json_str = match.group(0)
                ai_data = json.loads(json_str)
            else:
                # 抓不到就硬清 Markdown 看看
                clean_str = ai_content.replace("```json", "").replace("```", "").strip()
                ai_data = json.loads(clean_str)
        except Exception as e:
            print(f"JSON Parsing Error: {e}")
            return ChatResponse(
                message="抱歉，我目前腦袋有點打結（格式錯誤）。請點擊下方重新開始，或換個說法試試！",
                options=[{"label": "重新開始", "value": "Reset"}]
            )

        # ==========================================
        # 階段二：選項 (Options) 補救與防呆
        # ==========================================
        raw_options = ai_data.get("options", [])
        clean_options = []
        
        for opt in raw_options:
            label = str(opt.get("label", "")).strip()
            value = str(opt.get("value", "")).strip()
            
            if not value: continue # 沒有 value 就沒有意義，跳過
            
            if not label: # 如果 label 是空的，用 value 補
                label = value
                
            # 如果 AI 想結束，但忘記寫中文，我們幫他加
            if value.startswith("FINISH:") and (label == value or "FINISH" in label):
                label = f"確認搜尋：{value.replace('FINISH:', '')}"
                
            clean_options.append({"label": label, "value": value})
            
        # 如果經過上面一輪，一個選項都沒有，我們硬塞一個給使用者逃生
        if not clean_options and "FINISH" not in str(ai_data):
             clean_options.append({"label": "確認搜尋此主題", "value": f"FINISH:{request.message}"})

        # ==========================================
        # 階段三：處理推薦意圖 (撈資料庫)
        # ==========================================
        final_response = ChatResponse(
            message=ai_data.get("message", "請選擇下一步："),
            options=clean_options,
            recommendations=[] # 預設空的推薦列表
        )

        # 如果AI沒有補，但使用者有說要找論文，程式來補
        user_msg = request.message
        if not ai_data.get("recommend_intent"):
            if any(keyword in user_msg for keyword in ["最新", "經典", "推薦", "論文", "文章", "文獻"]):
                # 猜測排序方式
                sort_type = "classic" if "經典" in user_msg or "最多" in user_msg else "newest"
                # 嘗試從對話或選項中抓一個英文關鍵字
                guess_keyword = clean_options[0]['value'].replace("FINISH:", "") if clean_options else ""
                
                if guess_keyword:
                    ai_data["recommend_intent"] = {
                        "keywords": guess_keyword,
                        "sort": sort_type
                    }
                    print(f"後端自動補齊搜尋意圖！關鍵字: {guess_keyword}, 排序: {sort_type}")

        intent = ai_data.get("recommend_intent")
        if intent:
            keywords = intent.get("keywords", "")
            sort_type = intent.get("sort", "newest") # newest 或 classic
            
            print(f"觸發資料庫搜尋！關鍵字: {keywords}, 排序: {sort_type}")
            
            # 使用 SQLAlchemy 搜尋
            query = db.query(Paper).filter(Paper.title.ilike(f"%{keywords}%"))
            
            if sort_type == "newest":
                query = query.order_by(desc(Paper.publication_year))
            elif sort_type == "classic":
                query = query.order_by(desc(Paper.citation_count))
            
            # 撈前三筆
            top_papers = query.limit(3).all()
            
            recs = []
            for p in top_papers:
                recs.append(
                    PaperRecommendation(
                        id=p.id,
                        title=p.title,
                        publication_year=p.publication_year or 0,
                        citation_count=p.citation_count or 0,
                        link=p.doi 
                    )
                )
            
            final_response.recommendations = recs
            
            if not recs:
                 final_response.message += "\n\n(抱歉，目前的資料庫中沒有找到符合這個關鍵字的論文。)"

        # ==========================================
        # 最後回傳整理好的資料給前端
        # ==========================================
        return final_response
    
    except Exception as e:
        print(f"Server Error: {str(e)}")
        return ChatResponse(
            message="系統暫時無法連線到 AI 或發生錯誤，請稍後再試。",
            options=[]
        )

@app.post("/papers/manual")
def create_paper_manually(paper_in: PaperManualCreate, db: Session = Depends(get_db)):
    """接收手動填寫的論文資料，並存入資料庫"""
    try:
        # 1. 處理可以放純字串陣列的欄位 (keywords)
        keyword_list = [k.strip() for k in paper_in.keywords.split(',')] if getattr(paper_in, 'keywords', None) else []

        # 2. 建立論文物件 (先不把字串塞給 authors 和 tags)
        new_paper = Paper(
            title=paper_in.title,
            document_type=paper_in.document_type,
            publication_year=paper_in.publication_year,
            citation_count=paper_in.citation_count,
            doi=paper_in.doi,
            isbn=paper_in.isbn,
            url=paper_in.url,
            abstract=paper_in.abstract,
            venue_id=paper_in.venue_id,
            keywords=keyword_list, # keywords 是 ARRAY(String)，可以直接給 List
            page_count=paper_in.page_count,
            video_duration=paper_in.video_duration
        )
        
        # 先把論文存入，取得一個實體 ID，才能綁定作者
        db.add(new_paper)
        db.flush() 

        # 3. 處理作者關聯 (多對多)
        if paper_in.authors:
            author_names = [a.strip() for a in paper_in.authors.split(',') if a.strip()]
            for index, name in enumerate(author_names):
                # 尋找資料庫是否已經有這個作者
                author = db.query(Author).filter(Author.name == name).first()
                if not author:
                    # 沒有就新建一個
                    author = Author(name=name)
                    db.add(author)
                    db.flush()
                
                # 建立 PaperAuthor 中介表關聯
                paper_author = PaperAuthor(
                    paper_id=new_paper.id,
                    author_id=author.id,
                    author_order=index + 1
                )
                db.add(paper_author)

        # 4. 處理標籤關聯 (多對多) - 如果你的表單有傳送 tags 的話
        if getattr(paper_in, 'tags', None):
            tag_names = [t.strip() for t in paper_in.tags.split(',') if t.strip()]
            for name in tag_names:
                tag = db.query(Tag).filter(Tag.name == name).first()
                if not tag:
                    tag = Tag(name=name)
                    db.add(tag)
                    db.flush()
                
                paper_tag = PaperTag(
                    paper_id=new_paper.id,
                    tag_id=tag.id
                )
                db.add(paper_tag)

        # 5. 全部搞定，正式提交！
        db.commit()
        db.refresh(new_paper)
        
        return {"message": "論文新增成功！", "id": new_paper.id}
        
    except Exception as e:
        db.rollback() 
        print(f"Manual add error: {e}")
        raise HTTPException(status_code=500, detail=f"新增論文失敗：{str(e)}")