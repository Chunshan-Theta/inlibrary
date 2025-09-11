from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text
from typing import List, Optional
from models import Paper, Author, PaperAuthor, Tag, PaperTag, Venue
from schemas import (
    PaperCreate, PaperUpdate, AuthorCreate, TagCreate, VenueCreate, SearchFilters, 
    ComplexSearchQuery, FilterGroup, FilterCondition
)

# Paper CRUD operations
def create_paper(db: Session, paper: PaperCreate):
    # 創建論文記錄
    db_paper = Paper(
        title=paper.title,
        abstract=paper.abstract,
        publication_year=paper.publication_year,
        doi=paper.doi,
        citation_count=paper.citation_count,
        venue_id=paper.venue_id,
        keywords=paper.keywords
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)
    
    # 添加作者關聯
    for i, author_id in enumerate(paper.author_ids):
        paper_author = PaperAuthor(
            paper_id=db_paper.id,
            author_id=author_id,
            author_order=i + 1
        )
        db.add(paper_author)
    
    # 添加標籤關聯
    for tag_id in paper.tag_ids:
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
    
    # 構建查詢條件
    conditions = build_query_conditions(db, query_data.root, query)
    
    if conditions is not None:
        query = query.filter(conditions)
    
    return query.distinct().offset(skip).limit(limit).all()

def build_query_conditions(db: Session, group: FilterGroup, query):
    """遞歸構建查詢條件"""
    conditions = []
    
    # 處理當前群組的條件
    for condition in group.conditions:
        db_condition = build_single_condition(condition)
        if db_condition is not None:
            conditions.append(db_condition)
    
    # 遞歸處理子群組
    for subgroup in group.groups:
        subgroup_condition = build_query_conditions(db, subgroup, query)
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
                return func.to_tsvector('english', Paper.title).match(str(value))
            elif operator == 'equals':
                return Paper.title == str(value)
                
        elif field == 'abstract_keyword':
            if operator == 'contains':
                return func.to_tsvector('english', Paper.abstract).match(str(value))
            elif operator == 'equals':
                return Paper.abstract == str(value)
                
        elif field == 'author_name':
            # 注意：這裡需要在主查詢中處理 JOIN
            if operator == 'contains':
                return func.to_tsvector('english', Author.name).match(str(value))
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