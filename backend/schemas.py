from pydantic import BaseModel, ConfigDict
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

# Paper schemas
class PaperBase(BaseModel):
    title: str
    abstract: Optional[str] = None
    publication_year: int
    doi: Optional[str] = None
    citation_count: Optional[int] = 0
    venue_id: Optional[int] = None
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
    citation_count: Optional[int] = None
    venue_id: Optional[int] = None
    keywords: Optional[List[str]] = None
    pdf_file_path: Optional[str] = None
    file_size: Optional[int] = None
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

# Excel import schemas
class ExcelImportResult(BaseModel):
    total_rows: int
    successful_imports: int
    failed_imports: int
    errors: List[str]
    imported_papers: List[PaperResponse] 