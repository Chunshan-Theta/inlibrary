from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Union
from datetime import datetime

# Author schemas
class AuthorBase(BaseModel):
    name: str
    email: Optional[str] = None
    affiliation: Optional[str] = None

class AuthorCreate(AuthorBase):
    pass

class AuthorResponse(AuthorBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime

# Venue schemas
class VenueBase(BaseModel):
    name: str
    type: str  # 'journal' or 'conference'
    impact_factor: Optional[float] = None

class VenueCreate(VenueBase):
    pass

class VenueResponse(VenueBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime

# Tag schemas
class TagBase(BaseModel):
    name: str
    color: Optional[str] = '#6B7280'

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int

# 統計資料用的 Schemas
class YearCount(BaseModel):
    year: int
    count: int

class VenueCount(BaseModel):
    name: str
    type: str
    impact_factor: Optional[float] = None
    count: int

class TagCount(BaseModel):
    id: Optional[int]
    name: str
    color: str
    count: int

# Paper schemas
class PaperBase(BaseModel):
    title: str
    abstract: Optional[str] = None
    publication_year: int = Field(
        ..., 
        ge=1995, # 最小限制為 1995
        le=datetime.now().year, # 最大限制為當前年份
        description="論文/資源發表的年份"
    )
    document_type: Optional[str] = 'paper' # 新增：文件類型，預設為 'paper'
    doi: Optional[str] = None # 確保 DOI 可選/可為 None
    isbn: Optional[str] = None # 新增：書籍專屬
    citation_count: Optional[int] = 0
    venue_id: Optional[int] = None
    page_count: Optional[int] = None # 新增：ppt頁數
    video_duration: Optional[int] = None # 新增：影片時長（秒）
    keywords: Optional[List[str]] = None
    url: Optional[str] = None

class PaperCreate(PaperBase):
    author_ids: Optional[List[int]] = []
    tag_ids: Optional[List[int]] = []

class PaperUpdate(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    publication_year: Optional[int] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None # 新增
    citation_count: Optional[int] = None
    venue_id: Optional[int] = None
    keywords: Optional[List[str]] = None
    pdf_file_path: Optional[str] = None
    file_size: Optional[int] = None
    page_count: Optional[int] = None  # 新增
    video_duration: Optional[int] = None  # 新增
    url: Optional[str] = None
    author_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None

class PaperAuthorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    author_order: int
    is_corresponding: bool
    author: AuthorResponse

class PaperTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    tag: TagResponse

class PaperResponse(PaperBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    pdf_file_path: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    url: Optional[str] = None
    venue: Optional[VenueResponse] = None
    authors: List[PaperAuthorResponse] = []
    tags: List[PaperTagResponse] = []

# Search filters
class SearchFilters(BaseModel):
    title_keyword: Optional[str] = None
    author_name: Optional[str] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    min_citations: Optional[int] = None
    max_citations: Optional[int] = None
    abstract_keyword: Optional[str] = None
    venue_id: Optional[int] = None
    tags: Optional[List[str]] = None

# 新的複雜查詢構建器類型
class FilterCondition(BaseModel):
    id: str
    field: str  # 'title_keyword', 'author_name', etc.
    operator: str  # 'contains', 'equals', 'greater_than', etc.
    value: Union[str, int, List[str]]

class FilterGroup(BaseModel):
    id: str
    operator: str  # 'AND' or 'OR'
    conditions: List[FilterCondition] = []
    groups: List['FilterGroup'] = []

class ComplexSearchQuery(BaseModel):
    root: FilterGroup

# 需要更新 FilterGroup 的前向引用
FilterGroup.model_rebuild()

# 批量操作 schemas
class BatchTagOperation(BaseModel):
    paper_ids: List[int]
    tag_ids: List[int]
    operation: str  # 'add' 或 'remove'

class BatchTagResult(BaseModel):
    success_count: int
    error_count: int
    updated_paper_ids: List[int]
    errors: List[str]

# File import schemas
class FileColumnInfo(BaseModel):
    name: str
    sample_values: List[str]
    data_type: str
    non_null_count: int

class FilePreviewData(BaseModel):
    columns: List[FileColumnInfo]
    sample_rows: List[dict]
    total_rows: int
    filename: str

class FieldMapping(BaseModel):
    excel_column: str  # 保持命名以維持兼容性
    target_field: str
    is_required: bool = False

class FileImportConfig(BaseModel):
    field_mappings: List[FieldMapping]
    preview_file_id: str  # 臨時文件ID，用於後續導入

class FileImportResult(BaseModel):
    total_rows: int
    successful_imports: int
    failed_imports: int
    errors: List[str]
    imported_papers: List[PaperResponse]

# PDF 解析結果 Schema  這個是用於回傳解析結果給前端預覽的
class PDFInfoResponse(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    publication_year: Optional[int] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    venue: Optional[str] = None  # 期刊/會議名稱
    authors: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    page_count: Optional[int] = None # 新增：讓前端知道解析出了幾頁
    extracted_text_snippet: Optional[str] = None # 提取的前幾行文本，用於檢查

# 定義單篇論文的結構
class PaperRecommendation(BaseModel):
    id: int
    title: str
    publication_year: int
    citation_count: int
    link: Optional[str] = None  # DOI 或 PDF 的連結

# AI關鍵字導航
class ChatOption(BaseModel):
    label: str  # 顯示給使用者看 (中文)
    value: str  # 實際搜尋關鍵字 (英文 Academic Term)

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # 之前的對話紀錄 [{'role': 'user', 'content': '...'}, ...]

class ChatResponse(BaseModel):
    message: str # AI 的回應文字
    options: List[ChatOption] = [] # 建議選項
    recommendations: List[PaperRecommendation] = []

# 接收「手動新增表單」傳來的資料結構
class PaperManualCreate(BaseModel):
    title: str
    document_type: str = "paper"
    authors: str
    publication_year: Optional[int] = None
    citation_count: Optional[int] = 0
    doi: Optional[str] = None
    isbn: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None
    venue_id: Optional[int] = None
    keywords: Optional[str] = None
    tags: Optional[str] = None
    page_count: Optional[int] = None
    video_duration: Optional[int] = None

# Excel compatibility aliases
ExcelColumnInfo = FileColumnInfo
ExcelPreviewData = FilePreviewData  
ExcelImportConfig = FileImportConfig
ExcelImportResult = FileImportResult 