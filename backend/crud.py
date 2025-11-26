import unicodedata
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import and_, desc, or_, func, text, exists, case
from typing import List, Optional, Dict, Any
from models import Paper, Author, PaperAuthor, Tag, PaperTag, Venue
from schemas import (
    PaperCreate, PaperUpdate, AuthorCreate, TagCreate, VenueCreate, SearchFilters, 
    ComplexSearchQuery, FilterGroup, FilterCondition
)

# Paper CRUD operations
def check_doi_exists(db: Session, doi: str) -> bool:
    """檢查DOI是否已存在"""
    if not doi:
        return False
    return db.query(Paper).filter(Paper.doi == doi).first() is not None

def create_paper(db: Session, paper: PaperCreate):
    # 檢查DOI是否已存在
    if paper.doi and check_doi_exists(db, paper.doi):
        raise ValueError(f"DOI '{paper.doi}' 已存在")
    
    # 創建論文記錄
    db_paper = Paper(
        title=paper.title,
        abstract=paper.abstract,
        publication_year=paper.publication_year,
        doi=paper.doi,
        citation_count=paper.citation_count,
        venue_id=paper.venue_id,
        keywords=paper.keywords,
        url=paper.url,
        document_type=paper.document_type # 新增 document_type 欄位
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)
    
    # 添加作者關聯
    for i, author_id in enumerate(paper.author_ids):
        # 檢查是否已存在相同的關聯
        existing_relation = db.query(PaperAuthor).filter(
            and_(PaperAuthor.paper_id == db_paper.id, PaperAuthor.author_id == author_id)
        ).first()
        
        if not existing_relation:
            paper_author = PaperAuthor(
                paper_id=db_paper.id,
                author_id=author_id,
                author_order=i + 1
            )
            db.add(paper_author)
    
    # 添加標籤關聯
    for tag_id in paper.tag_ids:
        # 檢查是否已存在相同的關聯
        existing_relation = db.query(PaperTag).filter(
            and_(PaperTag.paper_id == db_paper.id, PaperTag.tag_id == tag_id)
        ).first()
        
        if not existing_relation:
            paper_tag = PaperTag(paper_id=db_paper.id, tag_id=tag_id)
            db.add(paper_tag)
    
    db.commit()
    db.refresh(db_paper)
    return db_paper

def get_papers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Paper).options(
        joinedload(Paper.venue),
        joinedload(Paper.authors).joinedload(PaperAuthor.author),
        joinedload(Paper.tags).joinedload(PaperTag.tag)
    ).offset(skip).limit(limit).all()

def get_paper(db: Session, paper_id: int):
    return db.query(Paper).options(
        joinedload(Paper.venue),
        joinedload(Paper.authors).joinedload(PaperAuthor.author),
        joinedload(Paper.tags).joinedload(PaperTag.tag)
    ).filter(Paper.id == paper_id).first()

def get_year_distribution(db):
    results = (
        db.query(Paper.publication_year, func.count(Paper.id))
        .group_by(Paper.publication_year)
        .order_by(Paper.publication_year)
        .all()
    )
    return [
        {"year": year, "count": count}
        for year, count in results
        if year is not None
    ]

def get_venue_distribution(db: Session):
    # 統計前15名期刊/會議
    result = db.query(
        Venue.name,
        Venue.type,
        Venue.impact_factor,
        func.count(Paper.id).label("count")
    ).join(Paper).group_by(Venue.id).order_by(desc("count")).limit(15).all()
    return [{"name": r.name, "type": r.type, "impact_factor": r.impact_factor, "count": r.count} for r in result]

def get_tag_distribution(db: Session):
    # 統計前5名標籤
    result = db.query(
        Tag.id,
        Tag.name,
        Tag.color,
        func.count(PaperTag.paper_id).label("count")
    ).join(PaperTag).group_by(Tag.id).order_by(desc("count")).limit(5).all()
    return [{"id": r.id, "name": r.name, "color": r.color, "count": r.count} for r in result]

def count_all_papers(db: Session) -> int:
    """計算所有論文的總數"""
    return db.query(Paper).count()

def count_papers_with_tag(db: Session, tag_name: str) -> int:
    """計算具有特定標籤的論文數量"""
    return db.query(Paper).join(PaperTag).join(Tag).filter(Tag.name == tag_name).count()

def update_paper(db: Session, paper_id: int, paper: PaperUpdate):
    db_paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not db_paper:
        return None
    
    # 更新基本字段
    for field, value in paper.model_dump(exclude_unset=True).items():
        if field not in ['author_ids', 'tag_ids'] and value is not None:
            setattr(db_paper, field, value)
    
    # 更新作者關聯
    if paper.author_ids is not None:
        # 刪除現有關聯
        db.query(PaperAuthor).filter(PaperAuthor.paper_id == paper_id).delete()
        # 添加新關聯
        for i, author_id in enumerate(paper.author_ids):
            # 檢查是否已存在相同的關聯（雖然上面已刪除，但為了防錯）
            existing_relation = db.query(PaperAuthor).filter(
                and_(PaperAuthor.paper_id == paper_id, PaperAuthor.author_id == author_id)
            ).first()
            
            if not existing_relation:
                paper_author = PaperAuthor(
                    paper_id=paper_id,
                    author_id=author_id,
                    author_order=i + 1
                )
                db.add(paper_author)
    
    # 更新標籤關聯
    if paper.tag_ids is not None:
        # 刪除現有關聯
        db.query(PaperTag).filter(PaperTag.paper_id == paper_id).delete()
        # 添加新關聯
        for tag_id in paper.tag_ids:
            # 檢查是否已存在相同的關聯（雖然上面已刪除，但為了防錯）
            existing_relation = db.query(PaperTag).filter(
                and_(PaperTag.paper_id == paper_id, PaperTag.tag_id == tag_id)
            ).first()
            
            if not existing_relation:
                paper_tag = PaperTag(paper_id=paper_id, tag_id=tag_id)
                db.add(paper_tag)
    
    db.commit()
    db.refresh(db_paper)
    return db_paper

def delete_paper(db: Session, paper_id: int):
    db_paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not db_paper:
        return False
    
    db.delete(db_paper)
    db.commit()
    return True

def search_papers(db: Session, filters: SearchFilters, skip: int = 0, limit: int = 100):
    """多條件搜索論文"""
    query = db.query(Paper).options(
        joinedload(Paper.venue),
        joinedload(Paper.authors).joinedload(PaperAuthor.author),
        joinedload(Paper.tags).joinedload(PaperTag.tag)
    )
    
    conditions = []
    
    # 標題關鍵字搜索（全文搜索）
    if filters.title_keyword:
        conditions.append(
            func.to_tsvector('english', Paper.title).match(filters.title_keyword)
        )
    
    # 摘要關鍵字搜索
    if filters.abstract_keyword:
        conditions.append(
            func.to_tsvector('english', Paper.abstract).match(filters.abstract_keyword)
        )
    
    # 作者姓名搜索
    if filters.author_name:
        query = query.join(PaperAuthor).join(Author)
        conditions.append(
            func.to_tsvector('english', Author.name).match(filters.author_name)
        )
    
    # 年份範圍
    if filters.year_from:
        conditions.append(Paper.publication_year >= filters.year_from)
    if filters.year_to:
        conditions.append(Paper.publication_year <= filters.year_to)
    
    # 引用數範圍
    if filters.min_citations:
        conditions.append(Paper.citation_count >= filters.min_citations)
    if filters.max_citations:
        conditions.append(Paper.citation_count <= filters.max_citations)
    
    # 期刊/會議
    if filters.venue_id:
        conditions.append(Paper.venue_id == filters.venue_id)
    
    # 標籤搜索
    if filters.tags:
        query = query.join(PaperTag).join(Tag)
        conditions.append(Tag.name.in_(filters.tags))
    
    # 應用所有條件
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.distinct().offset(skip).limit(limit).all()

def search_papers_complex(db: Session, query_data: ComplexSearchQuery, skip: int = 0, limit: int = 100):
    """處理複雜的 AND/OR 搜索查詢"""
    query = db.query(Paper).options(
        joinedload(Paper.venue),
        joinedload(Paper.authors).joinedload(PaperAuthor.author),
        joinedload(Paper.tags).joinedload(PaperTag.tag)
    )
    
    # 檢查是否需要 JOIN
    needs_author_join = check_needs_author_join(query_data.root)
    needs_tag_join = check_needs_tag_join(query_data.root)
    
    # 添加必要的 JOIN
    if needs_author_join:
        query = query.join(PaperAuthor).join(Author)
    
    if needs_tag_join:
        query = query.join(PaperTag).join(Tag)
    
    # 構建查詢條件
    conditions = build_query_conditions(db, query_data.root)
    
    if conditions is not None:
        query = query.filter(conditions)
    
    return query.distinct().offset(skip).limit(limit).all()

def check_needs_author_join(group: FilterGroup) -> bool:
    """檢查是否需要 author JOIN"""
    for condition in group.conditions:
        if condition.field == 'author_name':
            return True
    for subgroup in group.groups:
        if check_needs_author_join(subgroup):
            return True
    return False

def check_needs_tag_join(group: FilterGroup) -> bool:
    """檢查是否需要 tag JOIN"""
    for condition in group.conditions:
        if condition.field == 'tags':
            return True
    for subgroup in group.groups:
        if check_needs_tag_join(subgroup):
            return True
    return False

def build_query_conditions(db: Session, group: FilterGroup):
    """遞歸構建查詢條件"""
    conditions = []
    
    # 處理當前群組的條件
    for condition in group.conditions:
        db_condition = build_single_condition(condition)
        if db_condition is not None:
            conditions.append(db_condition)
    
    # 遞歸處理子群組
    for subgroup in group.groups:
        subgroup_condition = build_query_conditions(db, subgroup)
        if subgroup_condition is not None:
            conditions.append(subgroup_condition)
    
    if not conditions:
        return None
    
    # 根據操作符組合條件
    if group.operator == 'AND':
        return and_(*conditions)
    else:  # OR
        return or_(*conditions)

def build_single_condition(condition: FilterCondition):
    """構建單個搜索條件"""
    field = condition.field
    operator = condition.operator
    value = condition.value
    
    # 如果值為空，跳過此條件
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    
    try:
        if field == 'title_keyword':
            if operator == 'contains':
                return Paper.title.ilike(f'%{str(value)}%')
            elif operator == 'equals':
                return Paper.title == str(value)
                
        elif field == 'abstract_keyword':
            if operator == 'contains':
                return Paper.abstract.ilike(f'%{str(value)}%')
            elif operator == 'equals':
                return Paper.abstract == str(value)
                
        elif field == 'author_name':
            if operator == 'contains':
                return Author.name.ilike(f'%{str(value)}%')
            elif operator == 'equals':
                return Author.name == str(value)
                
        elif field == 'year_from':
            if operator in ['greater_than', 'greater_equal']:
                return Paper.publication_year >= int(value)
            elif operator == 'equals':
                return Paper.publication_year == int(value)
                
        elif field == 'year_to':
            if operator in ['less_than', 'less_equal']:
                return Paper.publication_year <= int(value)
            elif operator == 'equals':
                return Paper.publication_year == int(value)
                
        elif field == 'min_citations':
            if operator in ['greater_than', 'greater_equal']:
                return Paper.citation_count >= int(value)
            elif operator == 'equals':
                return Paper.citation_count == int(value)
                
        elif field == 'max_citations':
            if operator in ['less_than', 'less_equal']:
                return Paper.citation_count <= int(value)
            elif operator == 'equals':
                return Paper.citation_count == int(value)
                
        elif field == 'venue_id':
            if operator == 'equals':
                return Paper.venue_id == int(value)
                
        elif field == 'tags':
            if operator == 'in' and isinstance(value, list):
                return Tag.name.in_(value)
            elif operator == 'equals':
                tag_value = value[0] if isinstance(value, list) else str(value)
                return Tag.name == tag_value
                
    except (ValueError, TypeError):
        # 如果類型轉換失敗，跳過此條件
        pass
    
    return None

# Author CRUD operations
def create_author(db: Session, author: AuthorCreate):
    db_author = Author(**author.model_dump())
    db.add(db_author)
    db.commit()
    db.refresh(db_author)
    return db_author

def get_authors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Author).offset(skip).limit(limit).all()

def get_author(db: Session, author_id: int):
    return db.query(Author).filter(Author.id == author_id).first()

# Tag CRUD operations
def create_tag(db: Session, tag: TagCreate):
    db_tag = Tag(**tag.model_dump())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def get_tags(db: Session):
    return db.query(Tag).all()

def get_tag(db: Session, tag_id: int):
    return db.query(Tag).filter(Tag.id == tag_id).first()

# Venue CRUD operations
def create_venue(db: Session, venue: VenueCreate):
    db_venue = Venue(**venue.model_dump())
    db.add(db_venue)
    db.commit()
    db.refresh(db_venue)
    return db_venue

def get_venues(db: Session):
    return db.query(Venue).all()

def get_venue(db: Session, venue_id: int):
    return db.query(Venue).filter(Venue.id == venue_id).first()

# 批量標籤操作
def batch_add_tags_to_papers(db: Session, paper_ids: List[int], tag_ids: List[int]):
    """批量為論文添加標籤"""
    from schemas import BatchTagResult
    
    success_count = 0
    error_count = 0
    updated_paper_ids = []
    errors = []
    
    try:
        # 驗證論文存在
        existing_papers = db.query(Paper.id).filter(Paper.id.in_(paper_ids)).all()
        existing_paper_ids = [p.id for p in existing_papers]
        
        # 驗證標籤存在
        existing_tags = db.query(Tag.id).filter(Tag.id.in_(tag_ids)).all()
        existing_tag_ids = [t.id for t in existing_tags]
        
        if not existing_tag_ids:
            errors.append("沒有找到有效的標籤")
            return BatchTagResult(
                success_count=0,
                error_count=len(paper_ids),
                updated_paper_ids=[],
                errors=errors
            )
        
        for paper_id in existing_paper_ids:
            try:
                for tag_id in existing_tag_ids:
                    # 檢查關聯是否已存在
                    existing_relation = db.query(PaperTag).filter(
                        PaperTag.paper_id == paper_id,
                        PaperTag.tag_id == tag_id
                    ).first()
                    
                    if not existing_relation:
                        paper_tag = PaperTag(paper_id=paper_id, tag_id=tag_id)
                        db.add(paper_tag)
                
                success_count += 1
                updated_paper_ids.append(paper_id)
                
            except Exception as e:
                error_count += 1
                errors.append(f"論文 {paper_id} 添加標籤失敗: {str(e)}")
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        errors.append(f"批量操作失敗: {str(e)}")
        error_count = len(paper_ids)
        success_count = 0
        updated_paper_ids = []
    
    return BatchTagResult(
        success_count=success_count,
        error_count=error_count,
        updated_paper_ids=updated_paper_ids,
        errors=errors
    )

def batch_remove_tags_from_papers(db: Session, paper_ids: List[int], tag_ids: List[int]):
    """批量從論文中移除標籤"""
    from schemas import BatchTagResult
    
    success_count = 0
    error_count = 0
    updated_paper_ids = []
    errors = []
    
    try:
        for paper_id in paper_ids:
            try:
                # 刪除指定的標籤關聯
                deleted_count = db.query(PaperTag).filter(
                    PaperTag.paper_id == paper_id,
                    PaperTag.tag_id.in_(tag_ids)
                ).delete(synchronize_session=False)
                
                if deleted_count > 0:
                    success_count += 1
                    updated_paper_ids.append(paper_id)
                
            except Exception as e:
                error_count += 1
                errors.append(f"論文 {paper_id} 移除標籤失敗: {str(e)}")
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        errors.append(f"批量操作失敗: {str(e)}")
        error_count = len(paper_ids)
        success_count = 0
        updated_paper_ids = []
    
    return BatchTagResult(
        success_count=success_count,
        error_count=error_count,
        updated_paper_ids=updated_paper_ids,
        errors=errors
    ) 

def normalize_text(s: str):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("\u00a0", " ").replace("\u202f", " ")
    s = " ".join(s.split())  # 移除多餘空白
    return s.strip().lower()


def search_related_papers(db: Session, paper_data: PaperCreate, limit: int = 5):
    # (0) DOI 精準匹配
    if paper_data.doi:
        doi_clean = paper_data.doi.strip().lower()
        exists = (
            db.query(Paper)
            .filter(func.lower(Paper.doi) == doi_clean)
            .options(joinedload(Paper.authors).joinedload(PaperAuthor.author))
            .first()
        )
        if exists:
            return [exists]

    # (1) 標題比對
    title_norm = normalize_text(paper_data.title)

    # 使用 PostgreSQL LOWER + REPLACE 清洗資料庫字串
    db_title_norm = func.lower(
        func.replace(
            func.replace(
                func.replace(Paper.title, "\u00a0", " "),
                "\u202f",
                " "
            ),
            "  ",
            " "
        )
    )

    # 精準匹配（將雙空白變單空白）
    exact = db_title_norm == title_norm

    # 模糊匹配（不再用 %lowered_title%）
    fuzzy = db_title_norm.ilike(f"%{title_norm[:20]}%")  # 前20字強匹配

    query = (
        db.query(Paper)
        .options(joinedload(Paper.authors).joinedload(PaperAuthor.author))
        .filter(or_(exact, fuzzy))
    )

    results = query.distinct().limit(limit).all()

    if results:
        return results

    # fallback
    return db.query(Paper).limit(limit).all()

# def search_related_papers(db: Session, paper_data: PaperCreate, limit: int = 5):
#     """
#     根據新資源的元數據 (DOI、標題、作者、關鍵字) 搜索潛在相關的現有資源。
#     重點：
#     - 永遠優先執行 DOI 精準比對（禁止 miss）
#     - Title 做 Unicode 正規化 + 嚴格與鬆散比對
#     - 作者與關鍵字作為輔助
#     """

#     # ---------------------------------------------------------
#     # 🔍 (0) DOI 精準匹配 — 永遠第一順位，且不會 fail
#     # ---------------------------------------------------------
#     if paper_data.doi:
#         exists = (
#             db.query(Paper)
#             .filter(func.lower(Paper.doi) == paper_data.doi.strip().lower())
#             .options(
#                 joinedload(Paper.authors).joinedload(PaperAuthor.author),
#                 joinedload(Paper.tags).joinedload(PaperTag.tag)
#             )
#             .first()
#         )
#         if exists:
#             # 若 DOI 已存在 → 直接回傳該筆
#             return [exists]

#     # ---------------------------------------------------------
#     # 基礎 query：限制 Paper 類型
#     # ---------------------------------------------------------
#     query = (
#         db.query(Paper)
#         .options(
#             joinedload(Paper.authors).joinedload(PaperAuthor.author),
#             joinedload(Paper.tags).joinedload(PaperTag.tag)
#         )
#     )

#     conditions = []

#     # ---------------------------------------------------------
#     # (1) 標題比對：Unicode 正規化 + 精準 + 模糊
#     # ---------------------------------------------------------
#     if paper_data.title:
#         raw_title = paper_data.title

#         # Unicode 正規化（必要處理）
#         normalized = unicodedata.normalize("NFC", raw_title)

#         # 替換不常見空白符
#         clean_title = (
#             normalized.replace("\u00a0", " ")
#             .replace("\u202f", " ")
#             .strip()
#             .lower()
#         )

#         if clean_title:
#             # title 精準匹配（lower + trim）
#             exact_title = func.lower(func.trim(Paper.title)) == clean_title

#             # 模糊匹配
#             fuzzy_title = Paper.title.ilike(f"%{clean_title}%")

#             conditions.append(or_(exact_title, fuzzy_title))

#     # ---------------------------------------------------------
#     # (2) 作者比對：任何一位作者命中就算相關
#     # ---------------------------------------------------------
#     if getattr(paper_data, "author_names", None):
#         author_keys = [
#             k.strip().lower()
#             for k in paper_data.author_names.split(",")
#             if k.strip()
#         ]
#         if author_keys:
#             query = query.join(PaperAuthor).join(Author)
#             author_conditions = [
#                 func.lower(Author.name).ilike(f"%{k}%") for k in author_keys
#             ]
#             conditions.append(or_(*author_conditions))

#     # ---------------------------------------------------------
#     # (3) 關鍵字比對：標題/摘要模糊查詢
#     # ---------------------------------------------------------
#     if paper_data.keywords and isinstance(paper_data.keywords, list):
#         kw_conditions = []
#         for kw in paper_data.keywords:
#             if kw:
#                 kw_conditions.append(Paper.title.ilike(f"%{kw}%"))
#                 kw_conditions.append(Paper.abstract.ilike(f"%{kw}%"))

#         if kw_conditions:
#             conditions.append(or_(*kw_conditions))

#     # ---------------------------------------------------------
#     # (4) 合併條件
#     # ---------------------------------------------------------
#     if conditions:
#         query = query.filter(or_(*conditions))

#     results = query.distinct().limit(limit).all()

#     # ---------------------------------------------------------
#     # (5) fallback：至少回傳 limit 筆 → 讓 Step 4 一定會執行
#     # ---------------------------------------------------------
#     if not results:
#         results = (
#             db.query(Paper)
#             .limit(limit)
#             .all()
#         )

#     return results

def merge_paper(db: Session, paper_id: int, new_data: PaperCreate, mode: str, fields: List[str] = None):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        return None

    if mode == "keep_old":
        return paper

    if mode == "overwrite":
        # 直接覆蓋（完整更新）
        update = PaperUpdate(**new_data.model_dump())
        return update_paper(db, paper_id, update)

    if mode == "merge_fields":
        if not fields:
            return paper
        
        update_dict = {}
        raw = new_data.model_dump()

        for f in fields:
            if f in raw:
                update_dict[f] = raw[f]

        update = PaperUpdate(**update_dict)
        return update_paper(db, paper_id, update)

    return paper