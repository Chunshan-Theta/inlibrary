from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime

from database import get_db, engine
from models import Base, Paper, Author, PaperAuthor, Tag, PaperTag, Venue
from schemas import (
    PaperCreate, PaperResponse, PaperUpdate,
    AuthorCreate, AuthorResponse,
    TagCreate, TagResponse,
    VenueCreate, VenueResponse,
    SearchFilters,
    ComplexSearchQuery,
    ExcelImportResult,
    ExcelPreviewData,
    ExcelImportConfig,
    BatchTagOperation,
    BatchTagResult
)
from crud import (
    create_paper, get_papers, get_paper, update_paper, delete_paper,
    create_author, get_authors,
    create_tag, get_tags,
    create_venue, get_venues,
    search_papers, search_papers_complex,
    batch_add_tags_to_papers, batch_remove_tags_from_papers,
    count_all_papers, count_papers_with_tag
)
from minio_client import upload_file, download_file, delete_file
from excel_import import import_excel_file, preview_file, get_default_field_mappings, import_file_with_config, import_file

# 創建數據庫表
Base.metadata.create_all(bind=engine)

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

# 文件上傳下載端點
@app.post("/papers/{paper_id}/upload-pdf/")
async def upload_paper_pdf(
    paper_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上傳論文PDF文件"""
    # 驗證論文是否存在
    paper = get_paper(db, paper_id=paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="論文未找到")
    
    # 驗證文件類型
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只能上傳PDF文件")
    
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