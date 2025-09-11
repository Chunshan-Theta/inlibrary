import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Tuple
import re
from models import Paper, Author, PaperAuthor, Venue
from crud import create_author, create_venue, get_author, get_venue
from schemas import ExcelImportResult, PaperResponse

def clean_string(value: Any) -> Optional[str]:
    """清理字符串，處理NaN和空值"""
    if pd.isna(value) or value == '' or str(value).strip() == '':
        return None
    return str(value).strip()

def parse_authors(authors_str: str) -> List[str]:
    """解析作者字符串，Web of Science格式通常是 'Author1, A; Author2, B; Author3, C'"""
    if not authors_str:
        return []
    
    # 分割作者，使用分號
    authors = []
    for author in authors_str.split(';'):
        author = author.strip()
        if author:
            authors.append(author)
    
    return authors

def parse_keywords(keywords_str: str) -> List[str]:
    """解析關鍵字，通常用分號分隔"""
    if not keywords_str:
        return []
    
    keywords = []
    for keyword in keywords_str.split(';'):
        keyword = keyword.strip()
        if keyword:
            keywords.append(keyword)
    
    return keywords

def extract_year_from_date(date_str: str) -> Optional[int]:
    """從日期字符串中提取年份"""
    if not date_str:
        return None
    
    # 嘗試提取年份的正則表達式
    year_match = re.search(r'\b(\d{4})\b', str(date_str))
    if year_match:
        return int(year_match.group(1))
    
    return None

def get_or_create_author(db: Session, author_name: str) -> Optional[Author]:
    """獲取或創建作者"""
    try:
        # 先嘗試按名稱查找
        author = db.query(Author).filter(Author.name == author_name).first()
        if author:
            return author
        
        # 如果不存在，創建新作者
        from schemas import AuthorCreate
        author_data = AuthorCreate(name=author_name)
        return create_author(db, author_data)
    except Exception as e:
        print(f"創建或獲取作者 {author_name} 時出錯: {e}")
        return None

def get_or_create_venue(db: Session, venue_name: str, venue_type: str = "journal") -> Optional[Venue]:
    """獲取或創建期刊/會議"""
    try:
        # 先嘗試按名稱查找
        venue = db.query(Venue).filter(Venue.name == venue_name).first()
        if venue:
            return venue
        
        # 如果不存在，創建新期刊/會議
        from schemas import VenueCreate
        venue_data = VenueCreate(name=venue_name, type=venue_type)
        return create_venue(db, venue_data)
    except Exception as e:
        print(f"創建或獲取期刊/會議 {venue_name} 時出錯: {e}")
        return None

def map_excel_row_to_paper(row: pd.Series, db: Session) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """將Excel行映射為論文數據"""
    errors = []
    
    try:
        # 基本字段映射
        title = clean_string(row.get('Article Title'))
        if not title:
            errors.append("標題為空")
            return None, errors
        
        abstract = clean_string(row.get('Abstract'))
        doi = clean_string(row.get('DOI'))
        
        # 處理發表年份
        publication_year = None
        if 'Publication Year' in row and not pd.isna(row['Publication Year']):
            publication_year = int(row['Publication Year'])
        elif 'Publication Date' in row:
            publication_year = extract_year_from_date(str(row['Publication Date']))
        
        if not publication_year:
            errors.append("無法確定發表年份")
            return None, errors
        
        # 引用數
        citation_count = 0
        if 'Times Cited, WoS Core' in row and not pd.isna(row['Times Cited, WoS Core']):
            try:
                citation_count = int(row['Times Cited, WoS Core'])
            except:
                citation_count = 0
        
        # 處理期刊/會議
        venue_id = None
        source_title = clean_string(row.get('Source Title'))
        if source_title:
            # 根據Publication Type判斷類型
            venue_type = "journal"
            if 'Publication Type' in row:
                pub_type = clean_string(row['Publication Type'])
                if pub_type and pub_type.upper() in ['P', 'PROCEEDINGS']:
                    venue_type = "conference"
            
            venue = get_or_create_venue(db, source_title, venue_type)
            if venue:
                venue_id = venue.id
        
        # 處理關鍵字
        keywords = []
        if 'Author Keywords' in row:
            author_keywords = parse_keywords(clean_string(row['Author Keywords']) or "")
            keywords.extend(author_keywords)
        
        if 'Keywords Plus' in row:
            keywords_plus = parse_keywords(clean_string(row['Keywords Plus']) or "")
            keywords.extend(keywords_plus)
        
        # 去重
        keywords = list(set(keywords))
        
        # 處理作者
        author_ids = []
        if 'Authors' in row:
            authors_str = clean_string(row['Authors'])
            if authors_str:
                authors = parse_authors(authors_str)
                for author_name in authors:
                    author = get_or_create_author(db, author_name)
                    if author:
                        author_ids.append(author.id)
        
        paper_data = {
            'title': title,
            'abstract': abstract,
            'publication_year': publication_year,
            'doi': doi,
            'citation_count': citation_count,
            'venue_id': venue_id,
            'keywords': keywords,
            'author_ids': author_ids
        }
        
        return paper_data, errors
        
    except Exception as e:
        errors.append(f"處理行數據時出錯: {str(e)}")
        return None, errors

def import_excel_file(db: Session, file_content: bytes) -> ExcelImportResult:
    """導入Excel文件"""
    try:
        # 讀取Excel文件
        df = pd.read_excel(file_content)
        
        total_rows = len(df)
        successful_imports = 0
        failed_imports = 0
        errors = []
        imported_papers = []
        
        for index, row in df.iterrows():
            try:
                paper_data, row_errors = map_excel_row_to_paper(row, db)
                
                if paper_data:
                    # 創建論文
                    from schemas import PaperCreate
                    paper_create = PaperCreate(**paper_data)
                    
                    # 檢查DOI是否已存在
                    if paper_data.get('doi'):
                        existing_paper = db.query(Paper).filter(Paper.doi == paper_data['doi']).first()
                        if existing_paper:
                            errors.append(f"行 {index + 1}: DOI {paper_data['doi']} 已存在")
                            failed_imports += 1
                            continue
                    
                    # 檢查標題是否已存在
                    existing_paper = db.query(Paper).filter(Paper.title == paper_data['title']).first()
                    if existing_paper:
                        errors.append(f"行 {index + 1}: 標題 '{paper_data['title'][:50]}...' 已存在")
                        failed_imports += 1
                        continue
                    
                    from crud import create_paper
                    new_paper = create_paper(db, paper_create)
                    imported_papers.append(new_paper)
                    successful_imports += 1
                    
                else:
                    failed_imports += 1
                    for error in row_errors:
                        errors.append(f"行 {index + 1}: {error}")
                        
            except Exception as e:
                failed_imports += 1
                errors.append(f"行 {index + 1}: {str(e)}")
        
        return ExcelImportResult(
            total_rows=total_rows,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            errors=errors,
            imported_papers=imported_papers
        )
        
    except Exception as e:
        return ExcelImportResult(
            total_rows=0,
            successful_imports=0,
            failed_imports=0,
            errors=[f"讀取Excel文件時出錯: {str(e)}"],
            imported_papers=[]
        ) 